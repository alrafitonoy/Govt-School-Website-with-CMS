import { Router } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { cfg } from '../config.js';
import { q, one, tx } from '../core/db.js';
import { can } from '../core/auth.js';
import { audit, bad, HttpError, notFound, paging, randomToken } from '../core/util.js';
import { getConfig, getContent, moduleOn } from '../core/moduleStore.js';
import { sendTemplateQuietly } from '../core/mail.js';

export const feeFor = (admissionConfig, classId) => {
  const specific = admissionConfig.class_fees?.[classId];
  return Number(specific ?? admissionConfig.fee_default ?? 0);
};

const MFS = [
  { key: 'bkash', label: 'bKash' },
  { key: 'nagad', label: 'Nagad' },
  { key: 'rocket', label: 'Rocket' },
];

// The methods the admin has turned on, with only what the public needs to see.
export async function availableMethods() {
  const c = await getConfig('payments');
  const list = [];
  if (c.online_enabled) {
    if (c.sslcommerz_enabled && c.sslcommerz_store_id && c.sslcommerz_store_password) {
      list.push({ key: 'sslcommerz', mode: 'online', label: 'Pay online (card, bKash, Nagad, bank)', hint: 'You will go to the secure SSLCommerz payment page.' });
    }
    for (const m of MFS) {
      if (c[`${m.key}_number`]) {
        list.push({ key: m.key, mode: 'manual', label: m.label, number: c[`${m.key}_number`], hint: c.manual_instructions });
      }
    }
  }
  if (c.offline_enabled) {
    list.push({ key: 'office', mode: 'offline', label: 'Pay at the school office', hint: c.office_instructions });
    if (c.bank_details) list.push({ key: 'bank', mode: 'offline-ref', label: 'Bank deposit', hint: c.bank_details });
  }
  return list;
}

const newRef = () => `PAY${Date.now().toString(36).toUpperCase()}${randomToken(4).replace(/[-_]/g, 'X').toUpperCase()}`;

async function markPaid(payment, verifiedBy = null) {
  await tx(async (t) => {
    await t.q("UPDATE payments SET status = 'paid', paid_at = UTC_TIMESTAMP(), verified_by = ? WHERE id = ?", [verifiedBy, payment.id]);
    await t.q("UPDATE applications SET payment_status = 'paid' WHERE id = ?", [payment.application_id]);
    await t.q("UPDATE payments SET status = 'cancelled' WHERE application_id = ? AND id <> ? AND status IN ('pending','awaiting_verification')", [payment.application_id, payment.id]);
  });
  const a = await one('SELECT app_no, student_name, email FROM applications WHERE id = ?', [payment.application_id]);
  sendTemplateQuietly('payment_confirmed', a?.email, { app_no: a?.app_no, student_name: a?.student_name, amount: `${payment.currency} ${payment.amount}`, ref: payment.ref });
}

const gatewayHost = (c) => (c.sslcommerz_sandbox ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com');

async function startSslcommerz(payment, app, c) {
  const site = await getContent('site');
  const base = `${cfg.publicUrl}/api/public/payments/sslcommerz`;
  const params = new URLSearchParams({
    store_id: c.sslcommerz_store_id,
    store_passwd: c.sslcommerz_store_password,
    total_amount: String(payment.amount),
    currency: payment.currency,
    tran_id: payment.ref,
    success_url: `${base}/return`,
    fail_url: `${base}/return`,
    cancel_url: `${base}/return`,
    ipn_url: `${base}/ipn`,
    shipping_method: 'NO',
    product_name: `Admission application ${app.app_no}`,
    product_category: 'Education',
    product_profile: 'non-physical-goods',
    cus_name: app.student_name,
    cus_email: app.email || site.email || 'noreply@example.com',
    cus_add1: 'Bangladesh',
    cus_city: 'Bangladesh',
    cus_country: 'Bangladesh',
    cus_phone: app.mobile,
  });
  const res = await fetch(`${gatewayHost(c)}/gwprocess/v4/api.php`, { method: 'POST', body: params, signal: AbortSignal.timeout(20_000) });
  const data = await res.json().catch(() => ({}));
  if (data.status !== 'SUCCESS' || !data.GatewayPageURL) {
    console.error('SSLCommerz init failed:', data.failedreason || res.status);
    throw new HttpError(502, 'The payment gateway could not start this payment. Please try another method or contact the school.');
  }
  return data.GatewayPageURL;
}

// A callback only says what the sender claims. The payment is confirmed by asking the gateway directly.
async function settleSslcommerz(body) {
  const payment = await one('SELECT * FROM payments WHERE ref = ?', [String(body.tran_id || '').slice(0, 40)]);
  if (!payment || payment.method !== 'sslcommerz') return null;
  if (payment.status === 'paid') return payment;
  if (!body.val_id) {
    if (payment.status === 'pending') await q("UPDATE payments SET status = 'failed', gateway_data = ? WHERE id = ?", [String(body.status || '').slice(0, 40), payment.id]);
    return { ...payment, status: 'failed' };
  }
  const c = await getConfig('payments');
  const url = new URL(`${gatewayHost(c)}/validator/api/validationserverAPI.php`);
  url.search = new URLSearchParams({ val_id: String(body.val_id), store_id: c.sslcommerz_store_id, store_passwd: c.sslcommerz_store_password, format: 'json' });
  const check = await (await fetch(url, { signal: AbortSignal.timeout(20_000) })).json();
  const valid = ['VALID', 'VALIDATED'].includes(check.status)
    && check.tran_id === payment.ref
    && Number(check.amount) === Number(payment.amount)
    && check.currency_type === payment.currency;
  if (!valid) {
    await q("UPDATE payments SET status = 'failed', gateway_data = ? WHERE id = ?", [JSON.stringify({ status: check.status }), payment.id]);
    return { ...payment, status: 'failed' };
  }
  await q('UPDATE payments SET gateway_data = ? WHERE id = ?', [JSON.stringify({ val_id: check.val_id, bank_tran_id: check.bank_tran_id, card_type: check.card_type }), payment.id]);
  await markPaid(payment);
  return { ...payment, status: 'paid' };
}

const payLimit = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many payment attempts. Please wait a while.' } });

export const payments = {
  key: 'payments',
  title: 'Payments',
  description: 'Online and offline payment methods for application fees.',
  group: 'Academics',
  adminPath: '/payments',
  permissions: [{ key: 'payments.manage', label: 'View and verify payments' }],
  schema: [
    { key: 'currency', label: 'Currency', type: 'select', default: 'BDT', options: ['BDT'] },
    { key: 'online_enabled', label: 'Allow online payments', type: 'switch', default: false, section: 'Online payment' },
    { key: 'sslcommerz_enabled', label: 'Use SSLCommerz gateway', type: 'switch', default: false, section: 'Online payment' },
    { key: 'sslcommerz_sandbox', label: 'Test mode (sandbox)', type: 'switch', default: true, section: 'Online payment' },
    { key: 'sslcommerz_store_id', label: 'SSLCommerz store ID', type: 'text', section: 'Online payment' },
    { key: 'sslcommerz_store_password', label: 'SSLCommerz store password', type: 'secret', section: 'Online payment' },
    { key: 'bkash_number', label: 'bKash number', type: 'text', section: 'Send money by mobile banking', help: 'Leave empty to hide. Staff check the transaction ID by hand.' },
    { key: 'nagad_number', label: 'Nagad number', type: 'text', section: 'Send money by mobile banking' },
    { key: 'rocket_number', label: 'Rocket number', type: 'text', section: 'Send money by mobile banking' },
    { key: 'manual_instructions', label: 'Instructions', type: 'textarea', default: 'Send the fee to the number shown, then enter your number and the transaction ID below.', section: 'Send money by mobile banking' },
    { key: 'offline_enabled', label: 'Allow offline payments', type: 'switch', default: true, section: 'Offline payment' },
    { key: 'office_instructions', label: 'Office payment instructions', type: 'textarea', default: 'Pay at the school office during office hours. Bring your application number.', section: 'Offline payment' },
    { key: 'bank_details', label: 'Bank details', type: 'textarea', section: 'Offline payment', help: 'Leave empty to hide the bank deposit option.' },
  ],

  mount({ pub, admin }) {
    pub.post('/payments/start', moduleOn('payments'), payLimit, async (req, res) => {
      const appNo = String(req.body?.app_no || '').trim().toUpperCase().slice(0, 30);
      const mobile = String(req.body?.mobile || '').trim().slice(0, 20);
      const method = String(req.body?.method || '');
      const app = await one('SELECT * FROM applications WHERE app_no = ? AND mobile = ?', [appNo, mobile]);
      if (!app) throw notFound('No application matches those details.');
      if (Number(app.fee_amount) <= 0) throw bad('This application has no fee to pay.');
      if (app.payment_status === 'paid') throw bad('This application is already paid.');

      const chosen = (await availableMethods()).find((m) => m.key === method);
      if (!chosen) throw bad('That payment method is not available.');

      const c = await getConfig('payments');
      const ref = newRef();
      const payerRef = String(req.body?.payer_ref || '').trim().slice(0, 120);
      if (['manual', 'offline-ref'].includes(chosen.mode) && payerRef.length < 4) throw bad('Enter the transaction or deposit reference.');

      const status = chosen.mode === 'manual' || chosen.mode === 'offline-ref' ? 'awaiting_verification' : 'pending';
      await q("UPDATE payments SET status = 'cancelled' WHERE application_id = ? AND status IN ('pending','awaiting_verification')", [app.id]);
      const x = await q('INSERT INTO payments (ref, application_id, method, amount, currency, status, payer_ref) VALUES (?,?,?,?,?,?,?)', [ref, app.id, method, app.fee_amount, c.currency || 'BDT', status, payerRef || null]);

      if (chosen.mode === 'online') {
        const redirect = await startSslcommerz({ ref, amount: app.fee_amount, currency: c.currency || 'BDT' }, app, c);
        return res.json({ ref, redirect });
      }
      await q("UPDATE applications SET payment_status = 'pending' WHERE id = ?", [app.id]);
      await audit(req, 'payment.started', `${app.app_no} ${method}`);
      res.json({ ref, status, id: x.insertId });
    });

    const callbackBody = express.urlencoded({ extended: false, limit: '50kb' });

    // The shopper's browser is posted back here from the gateway.
    pub.post('/payments/sslcommerz/return', moduleOn('payments'), callbackBody, async (req, res) => {
      let settled = null;
      try {
        settled = await settleSslcommerz(req.body || {});
      } catch (err) {
        console.error('SSLCommerz return failed:', err.message);
      }
      const status = settled?.status === 'paid' ? 'paid' : 'failed';
      res.redirect(303, `${cfg.publicUrl}/payment/result?status=${status}&ref=${encodeURIComponent(settled?.ref || '')}`);
    });

    // Server-to-server notice, which still arrives if the shopper closes the tab.
    pub.post('/payments/sslcommerz/ipn', moduleOn('payments'), callbackBody, async (req, res) => {
      await settleSslcommerz(req.body || {}).catch((err) => console.error('SSLCommerz IPN failed:', err.message));
      res.json({ ok: true });
    });

    const r = Router();
    r.use(moduleOn('payments'), can('payments.manage'));

    r.get('/', async (req, res) => {
      const { limit, offset, page } = paging(req.query, 100, 25);
      const where = req.query.status ? 'WHERE p.status = ?' : '';
      const params = req.query.status ? [String(req.query.status)] : [];
      const [{ total }] = await q(`SELECT COUNT(*) AS total FROM payments p ${where}`, params);
      const items = await q(
        `SELECT p.id, p.ref, p.method, p.amount, p.currency, p.status, p.payer_ref, p.created_at, p.paid_at, a.app_no, a.student_name, a.mobile, a.id AS application_id
         FROM payments p JOIN applications a ON a.id = p.application_id ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );
      res.json({ items, total, page, limit });
    });

    r.post('/:id/verify', async (req, res) => {
      const p = await one('SELECT * FROM payments WHERE id = ?', [Number(req.params.id)]);
      if (!p) throw notFound();
      if (p.status === 'paid') throw bad('This payment is already marked as paid.');
      await markPaid(p, req.user.id);
      await audit(req, 'payment.verified', p.ref);
      res.json({ ok: true });
    });

    r.post('/:id/reject', async (req, res) => {
      const p = await one('SELECT * FROM payments WHERE id = ?', [Number(req.params.id)]);
      if (!p) throw notFound();
      if (p.status === 'paid') throw bad('A confirmed payment cannot be rejected.');
      await q("UPDATE payments SET status = 'failed', verified_by = ? WHERE id = ?", [req.user.id, p.id]);
      await q("UPDATE applications SET payment_status = 'unpaid' WHERE id = ?", [p.application_id]);
      await audit(req, 'payment.rejected', p.ref);
      res.json({ ok: true });
    });

    r.post('/record-offline', async (req, res) => {
      const app = await one('SELECT * FROM applications WHERE app_no = ?', [String(req.body?.app_no || '').trim().toUpperCase()]);
      if (!app) throw notFound('No application with that number.');
      if (app.payment_status === 'paid') throw bad('This application is already paid.');
      const c = await getConfig('payments');
      const ref = newRef();
      const x = await q("INSERT INTO payments (ref, application_id, method, amount, currency, status, payer_ref) VALUES (?,?,'office',?,?,'pending',?)", [ref, app.id, app.fee_amount, c.currency || 'BDT', String(req.body?.receipt || '').slice(0, 120) || null]);
      await markPaid({ id: x.insertId, application_id: app.id, ref, amount: app.fee_amount, currency: c.currency || 'BDT' }, req.user.id);
      await audit(req, 'payment.recorded', ref);
      res.status(201).json({ ref });
    });

    admin.use('/payments', r);
  },
};
