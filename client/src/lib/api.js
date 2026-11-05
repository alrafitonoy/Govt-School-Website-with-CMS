const BASE = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(method, url, body, isForm) {
  let res;
  try {
    res = await fetch(BASE + '/api' + url, {
      method,
      credentials: 'include',
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Could not reach the server. Please check your connection.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong.', res.status, data.details);
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body || {}),
  put: (url, body) => request('PUT', url, body || {}),
  del: (url) => request('DELETE', url),
  form: (url, formData) => request('POST', url, formData, true),
  upload: (file, purpose = 'image') => {
    const fd = new FormData();
    fd.append('file', file);
    return request('POST', `/admin/media?purpose=${purpose}`, fd, true);
  },
};

// Uploaded files are relative links, which need the API host when the front end lives elsewhere.
export const asset = (url) => (url && url.startsWith('/') ? BASE + url : url || '');
export const apiUrl = (path) => `${BASE}/api${path}`;

// Timestamps from the server are UTC.
export function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(String(value).replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Plain dates, such as a notice date, must not shift with the time zone.
export function formatDate(value) {
  if (!value) return '';
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
