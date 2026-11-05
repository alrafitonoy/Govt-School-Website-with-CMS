import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { cfg } from './config.js';
import { HttpError } from './core/util.js';
import { migrate } from './core/migrate.js';
import { attachUser, requireAuth, startSweeper } from './core/auth.js';
import { authRouter } from './core/authRoutes.js';
import { publicDir } from './core/media.js';
import { mountModules, setupModules } from './modules/index.js';
import { renderHtml, robots, sitemap } from './core/seoPages.js';

const app = express();
app.set('trust proxy', cfg.trustProxy);
app.disable('x-powered-by');

let ready = false;

if (cfg.forceHttps) {
  app.use((req, res, next) => (req.secure ? next() : res.redirect(301, cfg.publicUrl + req.originalUrl)));
}

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https://i.ytimg.com'],
      'font-src': ["'self'", 'data:'],
      'media-src': ["'self'"],
      'frame-src': ["'self'", 'https://www.youtube-nocookie.com', 'https://www.google.com'],
      'object-src': ["'none'"],
      'frame-ancestors': ["'self'"],
      'form-action': ["'self'"],
      'connect-src': ["'self'"],
      'upgrade-insecure-requests': cfg.forceHttps ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: cfg.allowedOrigins.length ? 'cross-origin' : 'same-site' },
  strictTransportSecurity: cfg.forceHttps ? { maxAge: 31536000, includeSubDomains: false } : false,
}));

app.use(compression({ threshold: 1024 }));

// Uploaded file names are random and never reused, so browsers may cache them for a long time.
app.use('/uploads', express.static(publicDir, {
  immutable: true,
  maxAge: '365d',
  index: false,
  dotfiles: 'deny',
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
}));

// Optional separate front end, such as GitHub Pages.
if (cfg.allowedOrigins.length) {
  app.use('/api', (req, res, next) => {
    const origin = req.get('origin');
    if (origin && cfg.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
}

const GATEWAY_CALLBACKS = /^\/api\/public\/payments\/sslcommerz\/(return|ipn)$/;

// CSRF protection: a state-changing request carrying a browser Origin must come from this site.
// Gateway callbacks are exempt because they come from the gateway and are re-verified with it.
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || GATEWAY_CALLBACKS.test(req.originalUrl.split('?')[0])) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  let host = null;
  try {
    host = new URL(origin).host;
  } catch {
    /* falls through to the rejection */
  }
  const selfHost = req.get('x-forwarded-host') || req.get('host');
  if (host === selfHost || cfg.allowedOrigins.includes(origin) || origin === new URL(cfg.publicUrl).origin) return next();
  next(new HttpError(403, 'This request came from another website and was blocked.'));
});

app.use('/api', rateLimit({
  windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
}));

app.use('/api', (req, res, next) => {
  if (ready) return next();
  res.status(503).json({ error: 'The site is starting or cannot reach its database.' });
});

app.use('/api', express.json({ limit: '2mb' }));

const pub = express.Router();
const admin = express.Router();
admin.use(attachUser, requireAuth, (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use('/api/auth', authRouter());
app.use('/api/public', pub);
app.use('/api/admin', admin);

app.use('/api', (req, res, next) => next(new HttpError(404, 'Not found.')));

app.get('/robots.txt', robots);
app.get('/sitemap.xml', sitemap);

app.use(express.static(cfg.clientDist, {
  index: false,
  setHeaders: (res, file) => {
    res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
  },
}));

app.use(async (req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method)) return next(new HttpError(404, 'Not found.'));
  if (!ready) return res.status(503).type('text').send('The site is starting. If this message stays, check the database settings and the server log.');
  renderHtml(req, res).catch(next);
});

// Internal details stay in the log and never reach the visitor.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  let status = err.status || 500;
  let message = err.message;
  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'That file is larger than the allowed size.' : 'That upload could not be accepted.';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'That request is too large.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'The request could not be read.';
  } else if (!(err instanceof HttpError)) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    status = 500;
    message = 'Something went wrong on the server. Please try again.';
  }
  if (req.originalUrl.startsWith('/api')) return res.status(status).json({ error: message, details: err.details });
  res.status(status).type('text').send(message);
});

export { app };

// The database is retried, so a slow or misconfigured one gives a clear message
// rather than a crash loop on shared hosting.
async function start(delay = 2000) {
  try {
    await migrate();
    await setupModules();
    mountModules(pub, admin);
    startSweeper();
    ready = true;
    console.log('Database ready.');
  } catch (err) {
    console.error(`Database not ready: ${err.message}. Retrying in ${Math.round(delay / 1000)}s.`);
    setTimeout(() => start(Math.min(delay * 2, 60_000)), delay).unref?.();
  }
}
start();

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
