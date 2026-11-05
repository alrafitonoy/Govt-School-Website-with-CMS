import crypto from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import { cfg } from '../config.js';
import { q } from './db.js';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export const bad = (message, details) => new HttpError(400, message, details);
export const notFound = (message = 'Not found.') => new HttpError(404, message);

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

// AES-256-GCM for secrets that must be readable again (SMTP and payment gateway passwords).
const encKey = crypto.createHash('sha256').update('secrets:' + cfg.appSecret).digest();

export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `enc:v1:${Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')}`;
}

export function decrypt(value) {
  if (!value || !String(value).startsWith('enc:v1:')) return value || '';
  try {
    const raw = Buffer.from(String(value).slice(7), 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    console.error('Could not decrypt a stored secret. Was APP_SECRET changed?');
    return '';
  }
}

export function cleanHtml(html) {
  return sanitizeHtml(String(html ?? ''), {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div', 'figure', 'figcaption'],
    allowedAttributes: { a: ['href', 'target', 'rel', 'class'], img: ['src', 'alt', 'width', 'height', 'loading'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
      img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }),
    },
  });
}

export function safeUrl(value) {
  const v = String(value ?? '').trim();
  if (!v) return '';
  if (v.startsWith('/') && !v.startsWith('//')) return v.slice(0, 500);
  if (/^https?:\/\/[^\s]+$/i.test(v) || /^(mailto:|tel:)[^\s]+$/i.test(v)) return v.slice(0, 500);
  throw bad(`"${v.slice(0, 60)}" is not a valid link.`);
}

const toBool = (v) => v === true || v === 1 || v === '1' || v === 'true';

// Coerces one value according to a field definition. Shared by config, content and CRUD forms.
export function coerce(field, value) {
  const label = field.label || field.key;
  const empty = value === undefined || value === null || value === '';
  if (field.required && empty) throw bad(`${label} is required.`);
  switch (field.type) {
    case 'html':
      return cleanHtml(value);
    case 'image':
    case 'url':
      return safeUrl(value);
    case 'number': {
      if (empty) return field.nullable ? null : Number(field.default ?? 0);
      const n = Number(value);
      if (!Number.isFinite(n)) throw bad(`${label} must be a number.`);
      if (field.min !== undefined && n < field.min) throw bad(`${label} must be at least ${field.min}.`);
      if (field.max !== undefined && n > field.max) throw bad(`${label} must be at most ${field.max}.`);
      return n;
    }
    case 'switch':
      return toBool(value);
    case 'select':
      if (empty) return field.nullable ? null : '';
      if (field.options && !field.options.some((o) => (o.value ?? o) === value)) throw bad(`${label} has an invalid value.`);
      return value;
    case 'date':
      if (empty) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw bad(`${label} must be a date.`);
      return String(value);
    case 'color':
      if (empty) return '';
      if (!/^#[0-9a-fA-F]{6}$/.test(String(value))) throw bad(`${label} must be a colour like #4f46e5.`);
      return String(value);
    case 'slug': {
      const s = String(value ?? '').trim().toLowerCase().replace(/^\/+|\/+$/g, '');
      if (!/^[a-z0-9][a-z0-9-]{5,59}$/.test(s)) throw bad(`${label} must be 6 to 60 characters, using only letters, numbers and hyphens.`);
      if (field.reserved?.includes(s)) throw bad(`"${s}" is already used by the website. Choose something else.`);
      return s;
    }
    case 'list': {
      const items = Array.isArray(value) ? value : [];
      return items.slice(0, 50).map((item) => cleanObject(field.fields, item));
    }
    case 'classes':
      return (Array.isArray(value) ? value : []).map(Number).filter(Number.isInteger);
    case 'class_fees': {
      const out = {};
      for (const [k, v] of Object.entries(value && typeof value === 'object' ? value : {})) {
        if (/^\d+$/.test(k) && v !== '' && v !== null && Number(v) >= 0) out[k] = Number(v);
      }
      return out;
    }
    case 'map_embed': {
      const v = String(value ?? '').trim();
      if (!v) return '';
      const src = v.match(/src="([^"]+)"/)?.[1] || v;
      if (!/^https:\/\/www\.google\.com\/maps\/embed\?/.test(src)) throw bad('Map must be a Google Maps "Embed a map" link.');
      return src;
    }
    default: {
      const s = String(value ?? '').trim();
      const max = field.max || (field.type === 'textarea' ? 5000 : 500);
      if (s.length > max) throw bad(`${label} is too long (limit ${max} characters).`);
      return s;
    }
  }
}

export function cleanObject(fields, input = {}) {
  const out = {};
  for (const field of fields) out[field.key] = coerce(field, input?.[field.key]);
  return out;
}

export async function audit(req, action, detail = '') {
  try {
    await q('INSERT INTO audit_log (user_id, action, detail, ip) VALUES (?,?,?,?)', [req?.user?.id || null, action, String(detail).slice(0, 500), req?.ip || null]);
  } catch (err) {
    console.error('audit failed', err.message);
  }
}

// Today's date in Bangladesh, for notice scheduling and session years.
export function todayBD() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
}

export const paging = (query, max = 100, fallback = 20) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(max, Math.max(1, parseInt(query.limit, 10) || fallback));
  return { page, limit, offset: (page - 1) * limit };
};

export const escapeLike = (s) => String(s).replace(/[\\%_]/g, '\\$&');
