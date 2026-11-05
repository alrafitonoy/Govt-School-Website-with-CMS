import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import crypto from 'node:crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { cfg } from '../config.js';
import { q, one, parseJson } from '../core/db.js';
import { can } from '../core/auth.js';
import { audit, bad, escapeLike, HttpError, notFound, paging, randomToken, todayBD } from '../core/util.js';
import { getConfig, getContent, isEnabled, moduleOn, saveRawContent } from '../core/moduleStore.js';
import { privateDir, processFile } from '../core/media.js';
import { sendTemplateQuietly } from '../core/mail.js';
import { allFields, cleanForm, DEFAULT_FORM, validateSubmission } from './admissionForm.js';
import { availableMethods, feeFor } from './payments.js';

const limiter = (limit, minutes, error) => rateLimit({ windowMs: minutes * 60_000, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { error } });
const applyLimit = limiter(10, 60, 'Too many applications from this connection. Please try again later.');
const statusLimit = limiter(30, 15, 'Too many status checks. Please wait a while and try again.');

const tmpDir = path.join(os.tmpdir(), 'school-cms-uploads');
const isOpen = (c) => {
  if (!c.open) return false;
  const today = todayBD();
  if (c.start_date && today < c.start_date) return false;
  if (c.end_date && today > c.end_date) return false;
  return true;
};

async function openClasses(c) {
  const rows = await q('SELECT id, name, level FROM classes WHERE active = 1 ORDER BY level');
  const open = c.open_classes || [];
  return open.length ? rows.filter((r) => open.includes(r.id)) : rows;
}

export const admission = {
  key: 'admission',
  title: 'Admission',
  description: 'Online admission form, applications and status tracking.',
  group: 'Academics',
  home: true,
  nav: { label: 'Admission', path: '/admission' },
  adminPath: '/admission',
  permissions: [{ key: 'admission.manage', label: 'Review applications and edit the admission form' }],
  defaultContent: { form: DEFAULT_FORM },
  schema: [
    { key: 'open', label: 'Accepting applications now', type: 'switch', default: true },
    { key: 'session_year', label: 'Admission session year', type: 'number', default: new Date().getFullYear() + 1, min: 2000, max: 2100 },
    { key: 'start_date', label: 'Opens on', type: 'date' },
    { key: 'end_date', label: 'Closes on', type: 'date' },
    { key: 'open_classes', label: 'Classes open for admission', type: 'classes', default: [], help: 'If none are ticked, all classes are open.' },
    { key: 'fee_default', label: 'Application fee (BDT)', type: 'number', default: 0, min: 0, help: 'Set 0 for no fee.' },
    { key: 'class_fees', label: 'Fee for specific classes', type: 'class_fees', default: {}, help: 'Leave a class empty to use the fee above.' },
    { key: 'closed_message', label: 'Message when closed', type: 'textarea', default: 'Admission is currently closed. Please check the noticeboard for dates.' },
    { key: 'instructions', label: 'Admission information', type: 'textarea', default: '' },
    { key: 'max_file_mb', label: 'Largest attachment (MB)', type: 'number', default: 5, min: 1, max: 25 },
  ],
  publicConfig: ['open'],

  mount({ pub, admin }) {
    pub.get('/admission/form', moduleOn('admission'), async (req, res) => {
      const c = await getConfig('admission');
      const { form } = await getContent('admission');
      const classes = await openClasses(c);
      res.json({
        open: isOpen(c),
        session_year: c.session_year,
        closed_message: c.closed_message,
        instructions: c.instructions,
        max_file_mb: c.max_file_mb,
        form,
        classes: classes.map((k) => ({ ...k, fee: feeFor(c, k.id) })),
      });
    });

    pub.post('/admission/apply', moduleOn('admission'), applyLimit, async (req, res, next) => {
      const c = await getConfig('admission');
      if (!isOpen(c)) throw bad(c.closed_message || 'Admission is closed.');
      const { form } = await getContent('admission');
      const fileFields = allFields(form).filter((x) => x.type === 'file');
      const upload = multer({ dest: tmpDir, limits: { fileSize: Number(c.max_file_mb) * 1024 * 1024, files: fileFields.length, fields: 200 } })
        .fields(fileFields.map((x) => ({ name: x.key, maxCount: 1 })));

      await new Promise((resolve, reject) => upload(req, res, (err) => (err ? reject(err) : resolve())));

      const uploaded = Object.values(req.files || {}).flat();
      const cleanupTemp = () => Promise.all(uploaded.map((u) => fs.rm(u.path, { force: true })));
      const stored = [];
      try {
        // Honeypot: real visitors never see this field, so a value means a bot. Pretend all is well.
        if (req.body.website) return res.status(201).json({ app_no: 'ADM-0', fee: 0, methods: [] });

        const raw = parseJson(req.body.data, {});
        const classes = await openClasses(c);
        const classesById = new Map(classes.map((k) => [k.id, k]));
        const { errors, data } = validateSubmission(form, raw, new Set(uploaded.map((u) => u.fieldname)), classesById);
        if (form.declaration && !raw.declaration) errors.declaration = 'Please accept the declaration.';
        if (Object.keys(errors).length) throw bad('Please correct the highlighted fields.', errors);

        const files = {};
        for (const u of uploaded) {
          const field = fileFields.find((x) => x.key === u.fieldname);
          const result = await processFile(u.path, field.accept === 'image' ? 'image' : 'document', privateDir, '');
          stored.push(result);
          files[u.fieldname] = { name: path.basename(result.url), mime: result.mime, original: Buffer.from(u.originalname, 'latin1').toString('utf8').slice(0, 200) };
          // The small thumbnail is not needed for private documents.
          if (result.thumb) await fs.rm(path.join(privateDir, path.basename(result.thumb)), { force: true });
        }

        const classId = Number(data.class_applying);
        const fee = (await isEnabled('payments')) ? feeFor(c, classId) : 0;
        const r = await q(
          'INSERT INTO applications (class_id, session_year, student_name, mobile, email, data, files, fee_amount, payment_status, ip) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [classId, c.session_year, data.student_name_en, data.guardian_mobile, data.guardian_email || null, JSON.stringify(data), JSON.stringify(files), fee, fee > 0 ? 'unpaid' : 'not_required', req.ip],
        );
        const appNo = `ADM-${c.session_year}-${String(r.insertId).padStart(5, '0')}`;
        await q('UPDATE applications SET app_no = ? WHERE id = ?', [appNo, r.insertId]);

        sendTemplateQuietly('admission_received', data.guardian_email, {
          student_name: data.student_name_en,
          app_no: appNo,
          fee: fee > 0 ? `BDT ${fee}` : 'None',
          link: `${cfg.publicUrl}/admission/status?app_no=${encodeURIComponent(appNo)}`,
        });

        res.status(201).json({ app_no: appNo, fee, methods: fee > 0 ? await availableMethods() : [] });
      } catch (err) {
        await Promise.all(stored.map((s) => fs.rm(path.join(privateDir, path.basename(s.url)), { force: true })));
        throw err;
      } finally {
        await cleanupTemp();
      }
    });

    pub.post('/admission/status', moduleOn('admission'), statusLimit, async (req, res) => {
      const appNo = String(req.body?.app_no || '').trim().toUpperCase().slice(0, 30);
      const mobile = String(req.body?.mobile || '').trim().slice(0, 20);
      const a = await one(
        `SELECT a.app_no, a.student_name, a.status, a.fee_amount, a.payment_status, a.created_at, a.session_year, k.name AS class_name
         FROM applications a LEFT JOIN classes k ON k.id = a.class_id WHERE a.app_no = ? AND a.mobile = ?`,
        [appNo, mobile],
      );
      if (!a) throw notFound('No application matches those details.');
      res.setHeader('Cache-Control', 'no-store');
      const owing = Number(a.fee_amount) > 0 && a.payment_status === 'unpaid';
      res.json({ ...a, methods: owing && (await isEnabled('payments')) ? await availableMethods() : [] });
    });

    const r = Router();
    r.use(moduleOn('admission'), can('admission.manage'));

    r.get('/applications', async (req, res) => {
      const { limit, offset, page } = paging(req.query, 100, 25);
      const where = [];
      const params = [];
      if (req.query.status) { where.push('a.status = ?'); params.push(String(req.query.status)); }
      if (req.query.class_id) { where.push('a.class_id = ?'); params.push(Number(req.query.class_id)); }
      if (req.query.search) {
        const like = `%${escapeLike(req.query.search)}%`;
        where.push('(a.app_no LIKE ? OR a.student_name LIKE ? OR a.mobile LIKE ?)');
        params.push(like, like, like);
      }
      const sql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [{ total }] = await q(`SELECT COUNT(*) AS total FROM applications a ${sql}`, params);
      const items = await q(
        `SELECT a.id, a.app_no, a.student_name, a.mobile, a.status, a.payment_status, a.fee_amount, a.created_at, k.name AS class_name
         FROM applications a LEFT JOIN classes k ON k.id = a.class_id ${sql} ORDER BY a.id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );
      res.json({ items, total, page, limit });
    });

    r.get('/applications/:id', async (req, res) => {
      const a = await one('SELECT a.*, k.name AS class_name FROM applications a LEFT JOIN classes k ON k.id = a.class_id WHERE a.id = ?', [Number(req.params.id)]);
      if (!a) throw notFound();
      const { form } = await getContent('admission');
      const payments = await q('SELECT * FROM payments WHERE application_id = ? ORDER BY id DESC', [a.id]);
      res.json({ ...a, data: parseJson(a.data, {}), files: parseJson(a.files, {}), form, payments: payments.map(({ gateway_data, ...p }) => p) });
    });

    r.put('/applications/:id', async (req, res) => {
      const statuses = ['submitted', 'reviewing', 'accepted', 'waitlisted', 'rejected'];
      if (!statuses.includes(req.body?.status)) throw bad('Choose a valid status.');
      await q('UPDATE applications SET status = ?, notes = ? WHERE id = ?', [req.body.status, String(req.body.notes || '').slice(0, 2000), Number(req.params.id)]);
      await audit(req, 'application.update', `${req.params.id} ${req.body.status}`);
      res.json({ ok: true });
    });

    r.delete('/applications/:id', async (req, res) => {
      const a = await one('SELECT id, app_no, files FROM applications WHERE id = ?', [Number(req.params.id)]);
      if (!a) throw notFound();
      for (const file of Object.values(parseJson(a.files, {}))) await fs.rm(path.join(privateDir, path.basename(file.name)), { force: true });
      await q('DELETE FROM applications WHERE id = ?', [a.id]);
      await audit(req, 'application.delete', a.app_no);
      res.json({ ok: true });
    });

    // Applicants' documents are private: only reachable through this signed-in route.
    r.get('/applications/:id/files/:key', async (req, res) => {
      const a = await one('SELECT files FROM applications WHERE id = ?', [Number(req.params.id)]);
      const file = a && parseJson(a.files, {})[req.params.key];
      if (!file) throw notFound();
      res.setHeader('Cache-Control', 'private, no-store');
      res.sendFile(path.basename(file.name), { root: privateDir, dotfiles: 'deny' });
    });

    r.get('/form', async (req, res) => res.json((await getContent('admission')).form));

    r.put('/form', async (req, res) => {
      const form = cleanForm(req.body);
      await saveRawContent('admission', { form });
      await audit(req, 'admission.form_update');
      res.json(form);
    });

    r.post('/form/reset', async (req, res) => {
      await saveRawContent('admission', { form: DEFAULT_FORM });
      await audit(req, 'admission.form_reset');
      res.json(DEFAULT_FORM);
    });

    admin.use('/admission', r);
  },
};
