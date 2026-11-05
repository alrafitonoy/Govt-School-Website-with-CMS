import { Router } from 'express';
import { q, one } from './db.js';
import { audit, coerce, notFound, paging } from './util.js';
import { can } from './auth.js';

// A standard admin CRUD router, driven by a field list. Column names only ever come from `fields`.
export function crudRouter({ table, fields, perm, orderBy = 'id DESC', label, beforeSave, beforeDelete, afterDelete }) {
  const r = Router();
  r.use(can(perm));

  r.get('/', async (req, res) => {
    const { limit, offset, page } = paging(req.query, 200, 50);
    const [{ total }] = await q(`SELECT COUNT(*) AS total FROM \`${table}\``);
    const items = await q(`SELECT * FROM \`${table}\` ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [limit, offset]);
    res.json({ items, total, page, limit });
  });

  const build = async (req) => {
    const data = {};
    for (const f of fields) {
      const v = coerce(f, req.body?.[f.key]);
      data[f.key] = typeof v === 'boolean' ? (v ? 1 : 0) : v;
    }
    return beforeSave ? (await beforeSave(data, req)) || data : data;
  };

  r.post('/', async (req, res) => {
    const data = await build(req);
    const keys = Object.keys(data);
    const result = await q(
      `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
      keys.map((k) => data[k]),
    );
    await audit(req, `${label}.create`, data.title || data.name || result.insertId);
    res.status(201).json(await one(`SELECT * FROM \`${table}\` WHERE id = ?`, [result.insertId]));
  });

  r.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!(await one(`SELECT id FROM \`${table}\` WHERE id = ?`, [id]))) throw notFound();
    const data = await build(req);
    const keys = Object.keys(data);
    await q(`UPDATE \`${table}\` SET ${keys.map((k) => `\`${k}\` = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => data[k]), id]);
    await audit(req, `${label}.update`, data.title || data.name || id);
    res.json(await one(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]));
  });

  r.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const row = await one(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
    if (!row) throw notFound();
    if (beforeDelete) await beforeDelete(row);
    await q(`DELETE FROM \`${table}\` WHERE id = ?`, [id]);
    if (afterDelete) await afterDelete(row);
    await audit(req, `${label}.delete`, row.title || row.name || id);
    res.json({ ok: true });
  });

  return r;
}
