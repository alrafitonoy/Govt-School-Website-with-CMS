import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { cfg } from '../config.js';
import { q, one, parseJson } from './db.js';
import { HttpError, sha256, randomToken } from './util.js';
import { getConfig } from './moduleStore.js';
import { passwordRuleProblem } from '../lib/passwordRules.js';

const scrypt = promisify(crypto.scrypt);

// scrypt is memory-hard and built into Node, so no native add-on is needed on shared hosting.
// Cost parameters are stored with each hash so they can be raised later.
const SCRYPT = { N: 2 ** 16, r: 8, p: 2 };
const KEYLEN = 64;
const maxmem = (N, r, p) => 128 * N * r * p * 2;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const { N, r, p } = SCRYPT;
  const key = await scrypt(password.normalize('NFKC'), salt, KEYLEN, { N, r, p, maxmem: maxmem(N, r, p) });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [alg, N, r, p, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: maxmem(Number(N), Number(r), Number(p)),
  });
  return crypto.timingSafeEqual(key, expected);
}

// Compared against when the email is unknown, so response time does not reveal which accounts exist.
export const DUMMY_HASH = await hashPassword(randomToken());

export async function passwordProblem(password, user = {}) {
  const { min_password_length: min = 10 } = await getConfig('security');
  return passwordRuleProblem(password, user.email, min);
}

// Brute force protection. Three buckets, so an attacker cannot lock a real admin out from
// elsewhere just by guessing at their address: the account bucket has a much higher limit.
function buckets(ip, email, base) {
  const e = String(email).toLowerCase();
  return [
    { id: sha256(`pair:${ip}:${e}`), limit: base.max, minutes: base.minutes },
    { id: sha256(`ip:${ip}`), limit: base.max * 4, minutes: base.minutes * 4 },
    { id: sha256(`acct:${e}`), limit: base.max * 10, minutes: base.minutes },
  ];
}

async function lockSettings() {
  const c = await getConfig('security');
  return { max: Number(c.max_login_attempts) || 5, minutes: Number(c.lockout_minutes) || 15 };
}

export async function loginLockedFor(ip, email) {
  const list = buckets(ip, email, await lockSettings());
  const rows = await q(
    'SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), MAX(locked_until)) AS secs FROM login_attempts WHERE bucket IN (?) AND locked_until > UTC_TIMESTAMP()',
    [list.map((b) => b.id)],
  );
  return Number(rows[0]?.secs) || 0;
}

export async function recordLoginFailure(ip, email) {
  for (const b of buckets(ip, email, await lockSettings())) {
    // Counts reset after a quiet period of twice the lockout. Repeat offenders keep the count, so locks get longer.
    await q(
      `INSERT INTO login_attempts (bucket, attempts, first_at) VALUES (?, 1, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         attempts = IF(first_at < UTC_TIMESTAMP() - INTERVAL ? MINUTE, 1, attempts + 1),
         first_at = IF(attempts = 1, UTC_TIMESTAMP(), first_at)`,
      [b.id, b.minutes * 2],
    );
    await q(
      `UPDATE login_attempts SET locked_until = UTC_TIMESTAMP() + INTERVAL LEAST(? * POW(2, FLOOR((attempts - ?) / ?)), 1440) MINUTE
       WHERE bucket = ? AND attempts >= ?`,
      [b.minutes, b.limit, b.limit, b.id, b.limit],
    );
  }
}

export async function clearLoginFailures(ip, email) {
  const list = buckets(ip, email, await lockSettings()).slice(0, 1).concat(buckets(ip, email, await lockSettings())[2]);
  await q('DELETE FROM login_attempts WHERE bucket IN (?)', [list.map((b) => b.id)]);
}

const COOKIE = 'sid';

function cookieOptions(expires) {
  const parts = ['Path=/', 'HttpOnly', `SameSite=${cfg.crossSiteCookies ? 'None' : 'Lax'}`];
  if (cfg.forceHttps || cfg.crossSiteCookies) parts.push('Secure');
  parts.push(expires ? `Expires=${expires.toUTCString()}` : 'Max-Age=0');
  return parts.join('; ');
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

export async function createSession(req, res, userId) {
  const { session_hours: hours = 12 } = await getConfig('security');
  const token = randomToken();
  const expires = new Date(Date.now() + Number(hours) * 3600_000);
  await q('INSERT INTO sessions (id_hash, user_id, expires_at, ip, user_agent) VALUES (?,?,?,?,?)', [
    sha256(token), userId, expires, req.ip, String(req.get('user-agent') || '').slice(0, 255),
  ]);
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; ${cookieOptions(expires)}`);
}

export async function destroySession(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) await q('DELETE FROM sessions WHERE id_hash = ?', [sha256(token)]);
  res.setHeader('Set-Cookie', `${COOKIE}=; ${cookieOptions(null)}`);
}

export async function revokeSessions(userId, exceptReq = null) {
  const keep = exceptReq ? readCookie(exceptReq, COOKIE) : null;
  await q('DELETE FROM sessions WHERE user_id = ? AND id_hash <> ?', [userId, keep ? sha256(keep) : '']);
}

export async function attachUser(req, res, next) {
  req.user = null;
  const token = readCookie(req, COOKIE);
  if (token) {
    const row = await one(
      `SELECT u.id, u.name, u.email, u.role, u.permissions FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id_hash = ? AND s.expires_at > UTC_TIMESTAMP() AND u.active = 1 AND u.email_verified_at IS NOT NULL`,
      [sha256(token)],
    );
    if (row) req.user = { ...row, permissions: parseJson(row.permissions, []) };
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in.'));
  next();
}

export const hasPerm = (user, perm) => user?.role === 'admin' || (user?.permissions || []).includes(perm);

export const can = (...perms) => (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Please sign in.'));
  if (perms.some((p) => hasPerm(req.user, p))) return next();
  next(new HttpError(403, 'You do not have permission to do this.'));
};

export const adminOnly = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  next(new HttpError(req.user ? 403 : 401, 'Administrator access is required.'));
};

export async function issueToken(userId, kind, hours) {
  const token = randomToken();
  await q('DELETE FROM user_tokens WHERE user_id = ? AND kind = ?', [userId, kind]);
  await q('INSERT INTO user_tokens (token_hash, user_id, kind, expires_at) VALUES (?,?,?,?)', [
    sha256(token), userId, kind, new Date(Date.now() + hours * 3600_000),
  ]);
  return token;
}

export async function consumeToken(token) {
  return one(
    `SELECT t.token_hash, t.kind, u.id, u.email, u.name FROM user_tokens t JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > UTC_TIMESTAMP() AND u.active = 1`,
    [sha256(String(token || ''))],
  );
}

export function startSweeper() {
  const sweep = async () => {
    try {
      await q('DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP()');
      await q('DELETE FROM user_tokens WHERE expires_at < UTC_TIMESTAMP() - INTERVAL 1 DAY');
      await q('DELETE FROM login_attempts WHERE first_at < UTC_TIMESTAMP() - INTERVAL 7 DAY');
      await q('DELETE FROM audit_log WHERE created_at < UTC_TIMESTAMP() - INTERVAL 365 DAY');
    } catch (err) {
      console.error('sweep failed', err.message);
    }
  };
  sweep();
  setInterval(sweep, 3600_000).unref();
}
