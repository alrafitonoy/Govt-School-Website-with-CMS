import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { cfg } from '../config.js';
import { q, one, tx } from './db.js';
import { audit, bad, HttpError, sha256 } from './util.js';
import {
  attachUser, clearLoginFailures, consumeToken, createSession, destroySession, DUMMY_HASH, hashPassword, issueToken,
  loginLockedFor, passwordProblem, recordLoginFailure, requireAuth, revokeSessions, verifyPassword,
} from './auth.js';
import { sendTemplateQuietly } from './mail.js';
import { adminPath, allPermissions } from './moduleStore.js';

const limiter = (max, minutes) => rateLimit({
  windowMs: minutes * 60_000, limit: max, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a while and try again.' },
});

const safeEqual = (a, b) => {
  const x = Buffer.from(sha256(String(a)));
  const y = Buffer.from(sha256(String(b)));
  return crypto.timingSafeEqual(x, y);
};

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 190;

export function authRouter() {
  const r = Router();
  r.use(attachUser);

  r.get('/setup-status', async (req, res) => {
    const { c } = await one("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
    res.json({ needsSetup: c === 0, keyConfigured: Boolean(cfg.setupKey) });
  });

  // First admin. Needs SETUP_KEY from the server environment, so a stranger who finds
  // a freshly deployed site cannot claim it.
  r.post('/setup', limiter(10, 15), async (req, res) => {
    const { name, email, password, setup_key: key } = req.body || {};
    if (!cfg.setupKey) throw bad('Set SETUP_KEY in the server environment first, then restart.');
    if (!safeEqual(key || '', cfg.setupKey)) throw new HttpError(403, 'The setup key is not correct.');
    const addr = String(email || '').trim().toLowerCase();
    if (!String(name || '').trim()) throw bad('Name is required.');
    if (!emailOk(addr)) throw bad('Enter a valid email address.');
    const problem = await passwordProblem(password, { email: addr });
    if (problem) throw bad(problem);
    const hash = await hashPassword(password);
    await tx(async (t) => {
      const [{ c }] = await t.q("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' FOR UPDATE");
      if (c > 0) throw new HttpError(409, 'Setup has already been completed.');
      await t.q("INSERT INTO users (name, email, password_hash, role, permissions, email_verified_at) VALUES (?,?,?,'admin','[]',UTC_TIMESTAMP())", [String(name).trim().slice(0, 120), addr, hash]);
    });
    await audit(req, 'setup.complete', addr);
    res.status(201).json({ ok: true });
  });

  r.post('/login', limiter(30, 15), async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 190);
    const password = String(req.body?.password || '').slice(0, 200);
    if (!email || !password) throw bad('Enter your email and password.');

    const locked = await loginLockedFor(req.ip, email);
    if (locked > 0) {
      await audit(req, 'login.blocked', email);
      throw new HttpError(429, `Too many failed attempts. Try again in ${Math.ceil(locked / 60)} minute(s).`);
    }

    const user = await one('SELECT id, password_hash, active, email_verified_at FROM users WHERE email = ?', [email]);
    const match = await verifyPassword(password, user?.password_hash || DUMMY_HASH);
    if (!user || !match || !user.active || !user.email_verified_at) {
      await recordLoginFailure(req.ip, email);
      await audit(req, 'login.failed', email);
      throw new HttpError(401, 'Email or password is not correct, or the account is not active yet.');
    }

    await clearLoginFailures(req.ip, email);
    await createSession(req, res, user.id);
    await q('UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', [user.id]);
    req.user = { id: user.id };
    await audit(req, 'login.success', email);
    res.json({ ok: true });
  });

  r.post('/logout', async (req, res) => {
    await destroySession(req, res);
    res.json({ ok: true });
  });

  r.get('/me', requireAuth, async (req, res) => {
    const { id, name, email, role, permissions } = req.user;
    res.json({ user: { id, name, email, role, permissions }, allPermissions: allPermissions(), adminPath: await adminPath() });
  });

  // Always answers the same way, so it cannot be used to discover which emails have accounts.
  r.post('/forgot', limiter(8, 30), async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const user = await one('SELECT id, name, email FROM users WHERE email = ? AND active = 1 AND email_verified_at IS NOT NULL', [email]);
    if (user) {
      const token = await issueToken(user.id, 'reset', 1);
      sendTemplateQuietly('password_reset', user.email, { name: user.name, link: `${cfg.publicUrl}/signin/reset?token=${token}` });
      await audit(req, 'password.reset_requested', email);
    }
    res.json({ ok: true });
  });

  r.post('/token-info', limiter(30, 15), async (req, res) => {
    const row = await consumeToken(req.body?.token);
    if (!row) throw bad('This link has expired or was already used.');
    res.json({ kind: row.kind, name: row.name, email: row.email });
  });

  // Finishes both activation (which verifies the email) and password reset.
  r.post('/redeem', limiter(20, 15), async (req, res) => {
    const row = await consumeToken(req.body?.token);
    if (!row) throw bad('This link has expired or was already used.');
    const problem = await passwordProblem(req.body?.password, row);
    if (problem) throw bad(problem);
    const hash = await hashPassword(req.body.password);
    await tx(async (t) => {
      await t.q('UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()) WHERE id = ?', [hash, row.id]);
      await t.q('UPDATE user_tokens SET used_at = UTC_TIMESTAMP() WHERE token_hash = ?', [row.token_hash]);
      await t.q('DELETE FROM sessions WHERE user_id = ?', [row.id]);
    });
    req.user = { id: row.id };
    await audit(req, row.kind === 'activate' ? 'account.activated' : 'password.reset', row.email);
    res.json({ ok: true });
  });

  r.post('/change-password', requireAuth, limiter(10, 15), async (req, res) => {
    const { current, next: nextPassword } = req.body || {};
    const row = await one('SELECT password_hash, email FROM users WHERE id = ?', [req.user.id]);
    if (!(await verifyPassword(String(current || '').slice(0, 200), row.password_hash))) throw bad('Your current password is not correct.');
    const problem = await passwordProblem(nextPassword, row);
    if (problem) throw bad(problem);
    await q('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(nextPassword), req.user.id]);
    await revokeSessions(req.user.id, req);
    await audit(req, 'password.changed', row.email);
    res.json({ ok: true });
  });

  return r;
}
