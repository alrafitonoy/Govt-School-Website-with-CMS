// The first-run installation wizard, shown until the site has settings.
// The rest of the app is only imported after the settings are saved, because it reads them on load.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import mysql from 'mysql2/promise';
import { dataDir, installKeyFile, isConfigured, removeConfig, writeConfig } from '../core/configFile.js';
import { passwordRuleProblem } from '../lib/passwordRules.js';
import { wizardPage } from './wizardPage.js';

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 190;

// Only someone with access to the hosting account can read the key, so a stranger
// who finds a freshly uploaded site cannot install it and take it over.
function loadInstallKey() {
  const file = installKeyFile();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  if (fs.existsSync(file)) {
    const saved = fs.readFileSync(file, 'utf8').trim();
    if (saved) return saved;
  }
  const key = crypto.randomBytes(12).toString('hex');
  fs.writeFileSync(file, `${key}\n`, { mode: 0o600 });
  return key;
}

const dbError = (err) => {
  switch (err.code) {
    case 'ER_ACCESS_DENIED_ERROR':
    case 'ER_DBACCESS_DENIED_ERROR':
    case 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR':
      return 'The database username or password is not correct, or this user has not been added to the database.';
    case 'ER_BAD_DB_ERROR':
      return 'That database does not exist. Create it first in hPanel under Databases, then try again.';
    case 'ECONNREFUSED':
    case 'ENOTFOUND':
    case 'ETIMEDOUT':
    case 'EHOSTUNREACH':
      return 'Could not reach the database server. On Hostinger the host is usually "localhost" or "127.0.0.1".';
    default:
      return `The database reported a problem: ${err.message}`;
  }
};

async function checkDatabase(db) {
  const conn = await mysql.createConnection({ ...db, connectTimeout: 10_000 });
  try {
    await conn.query('CREATE TABLE IF NOT EXISTS _install_check (id INT PRIMARY KEY) ENGINE=InnoDB');
    await conn.query('DROP TABLE _install_check');
    const [tables] = await conn.query("SHOW TABLES LIKE 'users'");
    if (!tables.length) return { hasAdmin: false };
    const [[row]] = await conn.query("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
    return { hasAdmin: row.c > 0 };
  } finally {
    await conn.end().catch(() => {});
  }
}

const readDb = (b) => ({
  host: String(b?.db_host || 'localhost').trim(),
  port: Number(b?.db_port) || 3306,
  database: String(b?.db_name || '').trim(),
  user: String(b?.db_user || '').trim(),
  password: String(b?.db_password ?? ''),
});

// Works out the proxy setup from this real request, so HTTPS and login lockouts behave correctly.
function detectProxy(req, publicUrl) {
  const forwarded = String(req.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const proto = String(req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
  return {
    trustProxy: forwarded.length,
    // Only forced when HTTPS really reached the app. Otherwise the site could redirect forever.
    forceHttps: publicUrl.startsWith('https://') && proto === 'https',
  };
}

function validate(body) {
  const errors = {};
  const db = readDb(body);
  if (!db.database) errors.db_name = 'Enter the database name.';
  if (!db.user) errors.db_user = 'Enter the database username.';

  let publicUrl = '';
  try {
    const u = new URL(String(body?.public_url || '').trim());
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad protocol');
    publicUrl = u.origin;
  } catch {
    errors.public_url = 'Enter the full website address, such as https://www.example.edu.bd';
  }
  if (!String(body?.school_name || '').trim()) errors.school_name = 'Enter the school name.';
  return { errors, db, publicUrl };
}

function validateAdmin(body) {
  const errors = {};
  const email = String(body?.admin_email || '').trim().toLowerCase();
  if (!String(body?.admin_name || '').trim()) errors.admin_name = 'Enter your name.';
  if (!emailOk(email)) errors.admin_email = 'Enter a valid email address.';
  const problem = passwordRuleProblem(body?.admin_password, email);
  if (problem) errors.admin_password = problem;
  if (body?.admin_password !== body?.admin_password2) errors.admin_password2 = 'The two passwords do not match.';
  return errors;
}

// Runs inside the wizard's request, so any failure is shown on the page.
async function finishInstall({ body, db, publicUrl, proxy, hasAdmin }) {
  const uploadDir = path.join(dataDir(), 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
  const settings = {
    NODE_ENV: 'production',
    PUBLIC_URL: publicUrl,
    DB_HOST: db.host,
    DB_PORT: db.port,
    DB_NAME: db.database,
    DB_USER: db.user,
    DB_PASSWORD: db.password,
    APP_SECRET: crypto.randomBytes(48).toString('base64url'),
    SETUP_KEY: crypto.randomBytes(16).toString('base64url'),
    TRUST_PROXY: proxy.trustProxy,
    FORCE_HTTPS: proxy.forceHttps,
    UPLOAD_DIR: uploadDir,
  };
  writeConfig(settings);
  for (const [k, v] of Object.entries(settings)) process.env[k] = String(v);

  const { migrate } = await import('../core/migrate.js');
  const { setupModules } = await import('../modules/index.js');
  const { adminPath, getContent, saveRawContent } = await import('../core/moduleStore.js');
  const { hashPassword } = await import('../core/auth.js');
  const { q } = await import('../core/db.js');

  await migrate();
  await setupModules();
  if (!hasAdmin) {
    await q("INSERT INTO users (name, email, password_hash, role, permissions, email_verified_at) VALUES (?,?,?,'admin','[]',UTC_TIMESTAMP())", [
      String(body.admin_name).trim().slice(0, 120),
      String(body.admin_email).trim().toLowerCase(),
      await hashPassword(body.admin_password),
    ]);
    const site = await getContent('site');
    await saveRawContent('site', {
      ...site,
      school_name: String(body.school_name).trim().slice(0, 200),
      email: String(body.admin_email).trim().toLowerCase(),
    });
  }
  return { adminAddress: hasAdmin ? null : await adminPath() };
}

export function runInstaller(setHandler) {
  const key = loadInstallKey();
  const keyFile = installKeyFile();
  console.log(`Installation needed. Open the website to begin. Install key file: ${keyFile}`);

  return new Promise((resolve) => {
    const app = express();
    app.disable('x-powered-by');
    let failedKeys = 0;
    let installing = false;

    app.use((req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      // The host may run several copies of the app, and another copy may have finished the install.
      if (!installing && isConfigured()) {
        resolve();
        return res.status(503).setHeader('Retry-After', '2').type('text').send('The site is starting. Please refresh in a few seconds.');
      }
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'");
      next();
    });
    app.use(express.json({ limit: '50kb' }));

    const requireKey = (req, res, next) => {
      if (failedKeys >= 20) return res.status(429).json({ error: 'Too many wrong keys. Restart the app from hPanel, then try again.' });
      const a = crypto.createHash('sha256').update(String(req.body?.install_key || '').trim()).digest();
      const b = crypto.createHash('sha256').update(key).digest();
      if (!crypto.timingSafeEqual(a, b)) {
        failedKeys += 1;
        return res.status(403).json({ error: 'That install key is not correct.', fields: { install_key: 'That install key is not correct.' } });
      }
      next();
    };

    app.post('/install/check-key', requireKey, (req, res) => res.json({ ok: true }));

    app.post('/install/test-db', requireKey, async (req, res) => {
      const db = readDb(req.body);
      if (!db.database || !db.user) return res.status(400).json({ error: 'Enter the database name and username.' });
      try {
        res.json(await checkDatabase(db));
      } catch (err) {
        res.status(400).json({ error: dbError(err) });
      }
    });

    app.post('/install/run', requireKey, async (req, res) => {
      if (installing) return res.status(409).json({ error: 'Installation is already running.' });
      const { errors, db, publicUrl } = validate(req.body);
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Please correct the highlighted fields.', fields: errors });

      let state;
      try {
        state = await checkDatabase(db);
      } catch (err) {
        return res.status(400).json({ error: dbError(err) });
      }
      if (!state.hasAdmin) {
        const adminErrors = validateAdmin(req.body);
        if (Object.keys(adminErrors).length) return res.status(400).json({ error: 'Please correct the highlighted fields.', fields: adminErrors });
      }

      installing = true;
      try {
        const done = await finishInstall({ body: req.body, db, publicUrl, proxy: detectProxy(req, publicUrl), hasAdmin: state.hasAdmin });
        fs.rmSync(keyFile, { force: true });
        res.json({ ok: true, reused: state.hasAdmin, ...done });
        setTimeout(() => {
          console.log('Installation complete. Starting the site.');
          resolve();
        }, 400);
      } catch (err) {
        console.error('Installation failed:', err);
        removeConfig();
        res.status(500).json({ error: `Installation stopped: ${err.message}. Restart the app from hPanel, then run the installer again.` });
        // The app modules have already read the failed settings, so a clean restart is needed.
        setTimeout(() => process.exit(1), 400);
      }
    });

    app.use('/install', (req, res, next) => (req.method === 'GET' ? next() : res.status(404).json({ error: 'Not found.' })));

    app.use((req, res) => {
      if (req.path !== '/install') return res.redirect(302, '/install');
      const host = req.get('x-forwarded-host') || req.get('host') || '';
      const proto = String(req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
      res.type('html').send(wizardPage({ suggestedUrl: `${proto}://${host}`, keyFile }));
    });

    setHandler(app);
  });
}
