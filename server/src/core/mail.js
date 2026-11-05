import nodemailer from 'nodemailer';
import { cfg } from '../config.js';
import { q, one } from './db.js';
import { getConfig, getContent, isEnabled } from './moduleStore.js';

export class MailNotConfigured extends Error {}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const absolute = (url) => (url && url.startsWith('/') ? cfg.publicUrl + url : url);

async function smtpSettings() {
  const c = await getConfig('email');
  if (c.smtp_host) {
    return { host: c.smtp_host, port: Number(c.smtp_port) || 465, secure: Boolean(c.smtp_secure), user: c.smtp_user, password: c.smtp_password, from: c.from_email || c.smtp_user, fromName: c.from_name };
  }
  return { ...cfg.smtp, fromName: c.from_name };
}

export async function mailReady() {
  if (!(await isEnabled('email'))) return false;
  return Boolean((await smtpSettings()).host);
}

// The standard branded layout every outgoing email is wrapped in. Tables and inline styles, for email clients.
export async function renderLayout(innerHtml, preheader = '') {
  const site = await getContent('site');
  const name = escapeHtml(site.school_name || 'School');
  const logo = site.logo ? `<img src="${escapeHtml(absolute(site.logo))}" alt="" height="48" style="height:48px;display:block;margin:0 auto 10px">` : '';
  const contact = [site.address, site.phone, site.email].filter(Boolean).map(escapeHtml).join(' &middot; ');
  const body = innerHtml.replace(
    /<a\b([^>]*?)\sclass="btn"([^>]*)>/g,
    '<a$1$2 style="display:inline-block;background:#000080;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">',
  );
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f3f6fb;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#1c2540">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fb;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3e8f2">
<tr><td style="height:6px;background:#000080;background-image:linear-gradient(90deg,#000080,#0a5fd6)"></td></tr>
<tr><td align="center" style="padding:28px 32px 8px">${logo}<div style="font-size:20px;font-weight:700;color:#0f1a3c">${name}</div></td></tr>
<tr><td style="padding:12px 32px 28px;font-size:15px;line-height:1.65">${body}</td></tr>
<tr><td align="center" style="padding:18px 32px;background:#f8fafd;border-top:1px solid #e3e8f2;font-size:12px;line-height:1.6;color:#667089">${name}${contact ? `<br>${contact}` : ''}<br><a href="${escapeHtml(cfg.publicUrl)}" style="color:#000080">${escapeHtml(cfg.publicUrl.replace(/^https?:\/\//, ''))}</a></td></tr>
</table></td></tr></table></body></html>`;
}

const toText = (html) => html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h\d|li|tr)>/gi, '\n').replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2: $1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();

export async function sendMail({ to, subject, html, template = null, sentBy = null }) {
  const smtp = await smtpSettings();
  if (!smtp.host || !(await isEnabled('email'))) throw new MailNotConfigured('Email is not configured.');
  const cleanSubject = String(subject).replace(/[\r\n]+/g, ' ').slice(0, 255);
  try {
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
      connectionTimeout: 15_000,
      socketTimeout: 30_000,
    });
    const body = await renderLayout(html, cleanSubject);
    await transport.sendMail({
      from: smtp.fromName ? { name: smtp.fromName, address: smtp.from } : smtp.from,
      to,
      subject: cleanSubject,
      html: body,
      text: toText(html),
    });
    await q("INSERT INTO email_log (to_addr, subject, template, status, sent_by) VALUES (?,?,?,'sent',?)", [to, cleanSubject, template, sentBy]);
  } catch (err) {
    await q("INSERT INTO email_log (to_addr, subject, template, status, error, sent_by) VALUES (?,?,?,'failed',?,?)", [to, cleanSubject, template, String(err.message).slice(0, 500), sentBy]);
    throw err;
  }
}

// Fills {{placeholders}}. Values are HTML-escaped, so names typed by the public cannot inject markup.
export function fill(text, vars, { escape = true } = {}) {
  return String(text).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    if (v === undefined || v === null) return '';
    return escape ? escapeHtml(v) : String(v);
  });
}

export async function sendTemplate(tkey, to, vars = {}, sentBy = null) {
  const tpl = await one('SELECT subject, body FROM email_templates WHERE tkey = ?', [tkey]);
  if (!tpl) throw new Error(`Missing email template ${tkey}`);
  const site = await getContent('site');
  const all = { school_name: site.school_name || 'School', ...vars };
  await sendMail({ to, subject: fill(tpl.subject, all, { escape: false }), html: fill(tpl.body, all), template: tkey, sentBy });
}

// For notifications that should never fail the request that triggered them.
export function sendTemplateQuietly(tkey, to, vars) {
  if (!to) return;
  sendTemplate(tkey, to, vars).catch((err) => {
    if (!(err instanceof MailNotConfigured)) console.error(`Email ${tkey} failed:`, err.message);
  });
}
