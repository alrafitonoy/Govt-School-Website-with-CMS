import path from 'node:path';
import crypto from 'node:crypto';
import { defaultUploadDir, loadConfig, ROOT } from './core/configFile.js';

export { ROOT };
loadConfig();

const env = process.env;
const isProd = env.NODE_ENV === 'production';

let appSecret = env.APP_SECRET || '';
if (appSecret.length < 32) {
  if (isProd) {
    console.error('FATAL: APP_SECRET must be set to at least 32 characters. See .env.example.');
    process.exit(1);
  }
  appSecret = crypto.createHash('sha256').update('dev-only-secret:' + ROOT).digest('hex');
}

const port = Number(env.PORT || 5000);

export const cfg = {
  isProd,
  port,
  publicUrl: (env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
  appSecret,
  setupKey: env.SETUP_KEY || '',
  trustProxy: Number(env.TRUST_PROXY || 0),
  forceHttps: env.FORCE_HTTPS === 'true',
  crossSiteCookies: env.CROSS_SITE_COOKIES === 'true',
  allowedOrigins: (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  uploadDir: path.resolve(env.UPLOAD_DIR || defaultUploadDir()),
  clientDist: path.join(ROOT, 'client', 'dist'),
  db: {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 3306),
    database: env.DB_NAME || 'school_cms',
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
  },
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 465),
    secure: env.SMTP_SECURE !== 'false',
    user: env.SMTP_USER || '',
    password: env.SMTP_PASSWORD || '',
    from: env.SMTP_FROM || '',
  },
};
