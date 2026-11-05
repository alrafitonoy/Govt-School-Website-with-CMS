// Finds and writes site settings. Has no other project imports, so it can run before the site is configured.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const rootEnv = path.join(ROOT, '.env');

// Hostinger replaces the app folder on every deploy, so settings and uploads must live outside it.
// There the app runs under /home/USER/domains/DOMAIN/..., and this folder sits beside public_html.
const hostedBase = () => ROOT.replace(/\\/g, '/').match(/^(.*\/domains\/[^/]+)\//)?.[1];

export function dataDir() {
  if (hostedBase()) return path.join(hostedBase(), 'school-cms-data');
  const id = crypto.createHash('sha1').update(ROOT).digest('hex').slice(0, 12);
  return path.join(os.homedir(), 'school-cms-data', id);
}

const dataEnv = () => path.join(dataDir(), 'config.env');

export function defaultUploadDir() {
  return hostedBase() ? path.join(dataDir(), 'uploads') : path.join(ROOT, 'uploads');
}

// Values already in the environment (such as hPanel variables) always win,
// except blank ones: a host may list a variable with no value, which means "not set".
export function loadConfig() {
  for (const key of ['NODE_ENV', 'PORT', 'PUBLIC_URL', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'APP_SECRET', 'SETUP_KEY', 'TRUST_PROXY', 'FORCE_HTTPS', 'UPLOAD_DIR']) {
    if (process.env[key] === '') delete process.env[key];
  }
  for (const file of [rootEnv, dataEnv()]) {
    if (fs.existsSync(file)) dotenv.config({ path: file, quiet: true });
  }
}

export function isConfigured() {
  loadConfig();
  return Boolean(process.env.DB_NAME && process.env.DB_USER);
}

function quote(value) {
  const s = String(value);
  const mark = ['"', "'", '`'].find((q) => !s.includes(q));
  if (!mark || /[\r\n]/.test(s)) throw new Error('A value contains characters that cannot be saved. If it is the database password, please change it.');
  return `${mark}${s}${mark}`;
}

export function writeConfig(values) {
  const body = Object.entries(values).map(([k, v]) => `${k}=${quote(v)}`).join('\n') + '\n';
  fs.mkdirSync(dataDir(), { recursive: true, mode: 0o700 });
  fs.writeFileSync(dataEnv(), body, { mode: 0o600 });
  return dataEnv();
}

export function removeConfig() {
  fs.rmSync(dataEnv(), { force: true });
}

export function installKeyFile() {
  return path.join(dataDir(), 'INSTALL_KEY.txt');
}
