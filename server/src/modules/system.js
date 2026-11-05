import { Router } from 'express';
import { cfg } from '../config.js';
import { q, one, parseJson } from '../core/db.js';
import { adminOnly, can, hasPerm, issueToken, requireAuth, revokeSessions } from '../core/auth.js';
import { audit, bad, cleanHtml, HttpError, notFound, paging } from '../core/util.js';
import { allPermissions, getConfig, moduleOn } from '../core/moduleStore.js';
import { deleteStored, imageOptimiserAvailable, storePublic, uploader } from '../core/media.js';
import { fill, MailNotConfigured, mailReady, sendMail, sendTemplate } from '../core/mail.js';

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 190;

export const media = {
  key: 'media',
  title: 'Media & Image Optimisation',
  description: 'Upload library. Images are resized and converted to WebP automatically.',
  group: 'System',
  locked: true,
  adminPath: '/media',
  permissions: [{ key: 'media.manage', label: 'Delete files from the media library' }],
  schema: [
    { key: 'max_image_width', label: 'Largest image width (pixels)', type: 'number', default: 1920, min: 480, max: 4000 },
    { key: 'image_quality', label: 'WebP quality (1 to 100)', type: 'number', default: 80, min: 30, max: 100 },
    { key: 'thumb_width', label: 'Thumbnail width (pixels)', type: 'number', default: 480, min: 120, max: 1000 },
    { key: 'max_image_mb', label: 'Largest image upload (MB)', type: 'number', default: 15, min: 1, max: 50 },
    { key: 'max_video_mb', label: 'Largest video upload (MB)', type: 'number', default: 100, min: 1, max: 1000, help: 'Check your hosting limit. YouTube links use no disk space.' },
  ],
  mount({ admin }) {
    const r = Router();

    // Any signed-in staff member may upload, because several modules need it. Files are checked by content.
    r.post('/', async (req, res) => {
      const purpose = String(req.query.purpose || 'image');
      const c = await getConfig('media');
      const notice = await getConfig('notices');
      const limits = { video: c.max_video_mb, notice: notice.max_upload_mb };
      const upload = await uploader('file', Number(limits[purpose] ?? c.max_image_mb));
      await new Promise((resolve, reject) => upload(req, res, (err) => (err ? reject(err) : resolve())));
      if (!req.file) throw bad('Choose a file to upload.');
      const stored = await storePublic(req.file, purpose, req);
      await audit(req, 'media.upload', stored.original_name);
      res.status(201).json(stored);
    });

    r.get('/', async (req, res) => {
      const { limit, offset, page } = paging(req.query, 100, 40);
      const kinds = String(req.query.kind || '').split(',').filter((k) => ['image', 'pdf', 'video', 'icon', 'audio'].includes(k));
      const where = kinds.length ? 'WHERE kind IN (?)' : '';
      const params = kinds.length ? [kinds] : [];
      const [{ total }] = await q(`SELECT COUNT(*) AS total FROM media ${where}`, params);
      const items = await q(`SELECT * FROM media ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
      res.json({ items, total, page, limit, optimiser: imageOptimiserAvailable() });
    });

    r.delete('/:id', can('media.manage'), async (req, res) => {
      const m = await one('SELECT * FROM media WHERE id = ?', [Number(req.params.id)]);
      if (!m) throw notFound();
      await deleteStored(m.url);
      await deleteStored(m.thumb_url);
      await q('DELETE FROM media WHERE id = ?', [m.id]);
      await audit(req, 'media.delete', m.original_name);
      res.json({ ok: true });
    });

    admin.use('/media', r);
  },
};

export const seo = {
  key: 'seo',
  title: 'SEO & Speed',
  description: 'Search engine title, description, sitemap and sharing image.',
  group: 'System',
  locked: true,
  permissions: [{ key: 'seo.manage', label: 'Edit SEO settings' }],
  contentSchema: [
    { key: 'meta_title', label: 'Search title', type: 'text', max: 70, help: 'Leave empty to use the school name.' },
    { key: 'meta_description', label: 'Search description', type: 'textarea', max: 300 },
    { key: 'og_image', label: 'Sharing image', type: 'image', purpose: 'image', help: 'Shown when the site is shared on Facebook or WhatsApp.' },
    { key: 'google_verification', label: 'Google Search Console code', type: 'text', max: 120 },
    { key: 'noindex', label: 'Hide the whole site from search engines', type: 'switch' },
  ],
  defaultContent: {},
};

export const security = {
  key: 'security',
  title: 'Security',
  description: 'Login protection, password rules and the activity log.',
  group: 'System',
  locked: true,
  adminOnly: true,
  adminPath: '/security',
  schema: [
    {
      key: 'admin_path', label: 'Admin panel address', type: 'slug', required: true, full: true,
      reserved: ['admin', 'administrator', 'wp-admin', 'login', 'signin', 'dashboard', 'api', 'uploads', 'assets', 'notices', 'results', 'about', 'message', 'achievements', 'gallery', 'facilities', 'admission', 'contact', 'payment'],
      help: 'The private part of the admin link, such as office-panel-2041. Pick something hard to guess. Staff reach it by signing in at /signin. If you change it, old bookmarks stop working.',
    },
    { key: 'max_login_attempts', label: 'Failed logins before lockout', type: 'number', default: 5, min: 3, max: 20 },
    { key: 'lockout_minutes', label: 'Lockout length (minutes)', type: 'number', default: 15, min: 1, max: 1440 },
    { key: 'min_password_length', label: 'Shortest allowed password', type: 'number', default: 10, min: 8, max: 64 },
    { key: 'session_hours', label: 'Stay signed in for (hours)', type: 'number', default: 12, min: 1, max: 168 },
  ],
  mount({ admin }) {
    admin.get('/security/log', adminOnly, async (req, res) => {
      const { limit, offset, page } = paging(req.query, 100, 50);
      const [{ total }] = await q('SELECT COUNT(*) AS total FROM audit_log');
      const items = await q(
        'SELECT l.id, l.action, l.detail, l.ip, l.created_at, u.name AS user_name FROM audit_log l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.id DESC LIMIT ? OFFSET ?',
        [limit, offset],
      );
      const [{ locks }] = await q('SELECT COUNT(*) AS locks FROM login_attempts WHERE locked_until > UTC_TIMESTAMP()');
      res.json({ items, total, page, limit, activeLocks: locks });
    });
  },
};

export const accounts = {
  key: 'accounts',
  title: 'User Accounts',
  description: 'Admin and staff accounts, permissions and email verification.',
  group: 'System',
  locked: true,
  adminOnly: true,
  adminPath: '/users',
  mount({ admin }) {
    const r = Router();
    r.use(adminOnly);

    const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, permissions: parseJson(u.permissions, []), active: Boolean(u.active), verified: Boolean(u.email_verified_at), last_login_at: u.last_login_at, created_at: u.created_at });

    const cleanPerms = (input) => {
      const known = new Set(allPermissions().map((p) => p.key));
      return (Array.isArray(input) ? input : []).filter((p) => known.has(p));
    };

    const adminCount = async () => (await one("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1")).c;

    async function sendActivation(user) {
      const token = await issueToken(user.id, 'activate', 72);
      const link = `${cfg.publicUrl}/signin/activate?token=${token}`;
      try {
        await sendTemplate('account_activation', user.email, { name: user.name, link });
        return { emailed: true };
      } catch (err) {
        // Without working email, the admin can still pass on the link themselves.
        return { emailed: false, link, reason: err instanceof MailNotConfigured ? 'Email is not configured yet.' : `Sending failed: ${err.message}` };
      }
    }

    r.get('/', async (req, res) => {
      res.json({ items: (await q('SELECT * FROM users ORDER BY role, name')).map(publicUser), permissions: allPermissions() });
    });

    r.post('/', async (req, res) => {
      const name = String(req.body?.name || '').trim().slice(0, 120);
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!name) throw bad('Name is required.');
      if (!emailOk(email)) throw bad('Enter a valid email address.');
      if (await one('SELECT id FROM users WHERE email = ?', [email])) throw bad('An account with this email already exists.');
      const role = req.body?.role === 'admin' ? 'admin' : 'staff';
      const x = await q('INSERT INTO users (name, email, role, permissions) VALUES (?,?,?,?)', [name, email, role, JSON.stringify(cleanPerms(req.body?.permissions))]);
      await audit(req, 'user.create', email);
      res.status(201).json({ id: x.insertId, ...(await sendActivation({ id: x.insertId, name, email })) });
    });

    r.put('/:id', async (req, res) => {
      const id = Number(req.params.id);
      const u = await one('SELECT * FROM users WHERE id = ?', [id]);
      if (!u) throw notFound();
      const role = req.body?.role === 'admin' ? 'admin' : 'staff';
      const active = req.body?.active ? 1 : 0;
      const losesAdmin = u.role === 'admin' && u.active && (role !== 'admin' || !active);
      if (losesAdmin && (await adminCount()) <= 1) throw bad('This is the only active administrator, so it must stay an active admin.');
      const name = String(req.body?.name || u.name).trim().slice(0, 120);
      const email = String(req.body?.email || u.email).trim().toLowerCase();
      if (!emailOk(email)) throw bad('Enter a valid email address.');
      const changedEmail = email !== u.email;
      if (changedEmail && (await one('SELECT id FROM users WHERE email = ? AND id <> ?', [email, id]))) throw bad('An account with this email already exists.');
      await q(
        `UPDATE users SET name=?, email=?, role=?, permissions=?, active=?${changedEmail ? ', email_verified_at = NULL, password_hash = NULL' : ''} WHERE id=?`,
        [name, email, role, JSON.stringify(cleanPerms(req.body?.permissions)), active, id],
      );
      if (!active || changedEmail) await revokeSessions(id);
      await audit(req, 'user.update', `${email} role=${role} active=${active}`);
      // A new address has to be verified again before it can be used to sign in.
      const activation = changedEmail ? await sendActivation({ id, name, email }) : null;
      res.json({ ok: true, activation });
    });

    r.post('/:id/resend', async (req, res) => {
      const u = await one('SELECT id, name, email, email_verified_at FROM users WHERE id = ?', [Number(req.params.id)]);
      if (!u) throw notFound();
      if (u.email_verified_at) throw bad('This account is already verified.');
      await audit(req, 'user.resend_activation', u.email);
      res.json(await sendActivation(u));
    });

    r.delete('/:id', async (req, res) => {
      const id = Number(req.params.id);
      if (id === req.user.id) throw bad('You cannot delete your own account.');
      const u = await one('SELECT role, active, email FROM users WHERE id = ?', [id]);
      if (!u) throw notFound();
      if (u.role === 'admin' && u.active && (await adminCount()) <= 1) throw bad('The only active administrator cannot be deleted.');
      await q('DELETE FROM users WHERE id = ?', [id]);
      await audit(req, 'user.delete', u.email);
      res.json({ ok: true });
    });

    admin.use('/users', r);
  },
};

export const email = {
  key: 'email',
  title: 'Email',
  description: 'SMTP settings, account emails, editable templates and custom messages.',
  group: 'System',
  adminPath: '/email',
  permissions: [{ key: 'email.send', label: 'Send emails and edit templates' }],
  schema: [
    { key: 'from_name', label: 'Sender name', type: 'text', section: 'Sender' },
    { key: 'from_email', label: 'Sender email', type: 'text', section: 'Sender', help: 'Use an address on your own domain, for better delivery.' },
    { key: 'smtp_host', label: 'SMTP host', type: 'text', section: 'SMTP server', help: 'For Hostinger email: smtp.hostinger.com' },
    { key: 'smtp_port', label: 'SMTP port', type: 'number', default: 465, section: 'SMTP server' },
    { key: 'smtp_secure', label: 'Use SSL/TLS (port 465)', type: 'switch', default: true, section: 'SMTP server' },
    { key: 'smtp_user', label: 'SMTP username', type: 'text', section: 'SMTP server' },
    { key: 'smtp_password', label: 'SMTP password', type: 'secret', section: 'SMTP server' },
  ],
  mount({ admin }) {
    const r = Router();
    r.use(moduleOn('email'), can('email.send'));

    r.get('/templates', async (req, res) => res.json({ items: await q('SELECT * FROM email_templates ORDER BY is_system DESC, name'), ready: await mailReady() }));

    r.post('/templates', async (req, res) => {
      const name = String(req.body?.name || '').trim().slice(0, 120);
      const subject = String(req.body?.subject || '').trim().slice(0, 255);
      if (!name || !subject) throw bad('Name and subject are required.');
      const tkey = `custom_${Date.now().toString(36)}`;
      const x = await q('INSERT INTO email_templates (tkey, name, subject, body) VALUES (?,?,?,?)', [tkey, name, subject, cleanHtml(req.body?.body)]);
      await audit(req, 'email.template_create', name);
      res.status(201).json({ id: x.insertId });
    });

    r.put('/templates/:id', async (req, res) => {
      const name = String(req.body?.name || '').trim().slice(0, 120);
      const subject = String(req.body?.subject || '').trim().slice(0, 255);
      if (!name || !subject) throw bad('Name and subject are required.');
      const body = cleanHtml(req.body?.body);
      await q('UPDATE email_templates SET name=?, subject=?, body=? WHERE id=?', [name, subject, body, Number(req.params.id)]);
      await audit(req, 'email.template_update', name);
      res.json({ ok: true });
    });

    r.delete('/templates/:id', async (req, res) => {
      const t = await one('SELECT is_system FROM email_templates WHERE id = ?', [Number(req.params.id)]);
      if (!t) throw notFound();
      if (t.is_system) throw bad('Built-in templates can be edited but not deleted.');
      await q('DELETE FROM email_templates WHERE id = ?', [Number(req.params.id)]);
      res.json({ ok: true });
    });

    r.post('/test', async (req, res) => {
      const to = String(req.body?.to || req.user.email).trim();
      if (!emailOk(to)) throw bad('Enter a valid email address.');
      try {
        await sendMail({ to, subject: 'Test email', html: '<p>Your email settings are working.</p>', template: 'test', sentBy: req.user.id });
      } catch (err) {
        throw bad(err instanceof MailNotConfigured ? 'Email is not configured yet.' : `Sending failed: ${err.message}`);
      }
      res.json({ ok: true });
    });

    // Works out who a message goes to, from named groups and typed addresses.
    async function recipients(body) {
      const map = new Map();
      for (const addr of String(body.emails || '').split(/[\s,;]+/)) {
        if (emailOk(addr)) map.set(addr.toLowerCase(), { name: 'Sir/Madam' });
      }
      if (body.groups?.includes('staff')) {
        for (const u of await q('SELECT name, email FROM users WHERE active = 1')) map.set(u.email, { name: u.name });
      }
      if (body.groups?.includes('applicants')) {
        const status = ['submitted', 'reviewing', 'accepted', 'waitlisted', 'rejected'].includes(body.applicant_status) ? body.applicant_status : null;
        const rows = await q(`SELECT student_name, email, app_no FROM applications WHERE email IS NOT NULL ${status ? 'AND status = ?' : ''}`, status ? [status] : []);
        for (const a of rows) map.set(a.email.toLowerCase(), { name: 'Guardian', student_name: a.student_name, app_no: a.app_no });
      }
      return map;
    }

    r.post('/send', async (req, res) => {
      if (!(await mailReady())) throw bad('Email is not configured yet. Add your SMTP settings first.');
      const subject = String(req.body?.subject || '').trim();
      const body = cleanHtml(req.body?.body);
      if (!subject || !body) throw bad('Subject and message are required.');
      const list = await recipients(req.body || {});
      if (list.size === 0) throw bad('Choose at least one recipient.');
      if (list.size > 500) throw bad('A message can go to at most 500 people at once, because hosting plans limit hourly email.');
      await audit(req, 'email.send', `${subject} to ${list.size}`);
      const sentBy = req.user.id;
      const site = await one("SELECT content FROM modules WHERE mkey = 'site'");
      const school = parseJson(site?.content, {}).school_name;
      res.status(202).json({ queued: list.size });
      // Sent after replying, one at a time, because shared hosts throttle SMTP. Results appear in the log.
      (async () => {
        for (const [to, vars] of list) {
          const all = { school_name: school, ...vars };
          await sendMail({ to, subject: fill(subject, all, { escape: false }), html: fill(body, all), template: req.body.template || 'custom', sentBy }).catch(() => {});
          await new Promise((done) => setTimeout(done, 400));
        }
      })();
    });

    r.get('/log', async (req, res) => {
      const { limit, offset, page } = paging(req.query, 100, 30);
      const [{ total }] = await q('SELECT COUNT(*) AS total FROM email_log');
      res.json({ items: await q('SELECT id, to_addr, subject, template, status, error, created_at FROM email_log ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset]), total, page, limit });
    });

    admin.use('/email', r);
  },
};
