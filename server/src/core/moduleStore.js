import crypto from 'node:crypto';
import { q, one, parseJson } from './db.js';
import { coerce, cleanObject, encrypt, decrypt, HttpError, notFound } from './util.js';

const registry = new Map();
let cache = null;
let cachedAt = 0;
const TTL = 30_000;

export const registerModule = (manifest) => registry.set(manifest.key, manifest);
export const manifests = () => [...registry.values()];
export const manifest = (key) => registry.get(key);

export function allPermissions() {
  return manifests().flatMap((m) => (m.permissions || []).map((p) => ({ ...p, module: m.key, moduleTitle: m.title })));
}

const defaultsFor = (m) => Object.fromEntries((m.schema || []).map((f) => [f.key, f.default ?? (f.type === 'switch' ? false : '')]));

export async function syncModules() {
  let sort = 0;
  for (const m of manifests()) {
    sort += 10;
    await q('INSERT IGNORE INTO modules (mkey, enabled, sort_order, config, content) VALUES (?,?,?,?,?)', [
      m.key,
      m.defaultEnabled === false ? 0 : 1,
      sort,
      JSON.stringify(defaultsFor(m)),
      JSON.stringify(m.defaultContent || {}),
    ]);
  }
  invalidate();
}

// The admin panel's address is unique to each site, so bots cannot guess it from this code.
// It is only ever sent to signed-in users and to browsers already on that address.
export async function ensureAdminPath() {
  const row = await one("SELECT config FROM modules WHERE mkey = 'security'");
  const config = parseJson(row?.config, {});
  if (config.admin_path) return;
  config.admin_path = `manage-${crypto.randomBytes(6).toString('hex')}`;
  await q("UPDATE modules SET config = ? WHERE mkey = 'security'", [JSON.stringify(config)]);
  invalidate();
}

export const adminPath = async () => `/${(await getConfig('security')).admin_path}`;

export function invalidate() {
  cache = null;
}

async function load() {
  if (cache && Date.now() - cachedAt < TTL) return cache;
  const rows = await q('SELECT * FROM modules ORDER BY sort_order, mkey');
  cache = new Map(
    rows
      .filter((r) => registry.has(r.mkey))
      .map((r) => {
        const m = registry.get(r.mkey);
        return [
          r.mkey,
          {
            key: r.mkey,
            enabled: m.locked ? true : Boolean(r.enabled),
            sort: r.sort_order,
            config: { ...defaultsFor(m), ...parseJson(r.config, {}) },
            content: { ...(m.defaultContent || {}), ...parseJson(r.content, {}) },
          },
        ];
      }),
  );
  cachedAt = Date.now();
  return cache;
}

export async function moduleStates() {
  return [...(await load()).values()];
}

export async function isEnabled(key) {
  return Boolean((await load()).get(key)?.enabled);
}

// Config for server use, with secrets decrypted.
export async function getConfig(key) {
  const state = (await load()).get(key);
  if (!state) return {};
  const out = { ...state.config };
  for (const f of registry.get(key).schema || []) {
    if (f.type === 'secret') out[f.key] = decrypt(out[f.key]);
  }
  return out;
}

export async function getContent(key) {
  return (await load()).get(key)?.content || {};
}

// Config for the admin UI: secrets are never sent back, only whether one is saved.
export function adminConfigView(m, config) {
  const out = { ...config };
  for (const f of m.schema || []) {
    if (f.type === 'secret') {
      out[`${f.key}__set`] = Boolean(config[f.key]);
      out[f.key] = '';
    }
  }
  return out;
}

export async function saveConfig(key, input) {
  const m = registry.get(key);
  const row = await one('SELECT config FROM modules WHERE mkey = ?', [key]);
  if (!m || !row) throw notFound();
  const previous = parseJson(row.config, {});
  const next = {};
  for (const f of m.schema || []) {
    if (f.type === 'secret') {
      const clear = input[`${f.key}__clear`];
      const value = String(input[f.key] ?? '');
      next[f.key] = clear ? '' : value ? encrypt(value) : previous[f.key] || '';
    } else {
      next[f.key] = coerce(f, input[f.key]);
    }
  }
  await q('UPDATE modules SET config = ? WHERE mkey = ?', [JSON.stringify(next), key]);
  invalidate();
}

export async function saveContent(key, input) {
  const m = registry.get(key);
  if (!m?.contentSchema) throw notFound();
  const next = m.cleanContent ? m.cleanContent(input) : cleanObject(m.contentSchema, input);
  await q('UPDATE modules SET content = ? WHERE mkey = ?', [JSON.stringify(next), key]);
  invalidate();
  return next;
}

// Writes content the module itself controls, such as the admission form definition.
export async function saveRawContent(key, content) {
  await q('UPDATE modules SET content = ? WHERE mkey = ?', [JSON.stringify(content), key]);
  invalidate();
}

// A disabled module's routes behave as if they do not exist.
export const moduleOn = (key) => async (req, res, next) => {
  if (await isEnabled(key)) return next();
  next(new HttpError(404, 'This feature is not enabled.'));
};
