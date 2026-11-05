import mysql from 'mysql2/promise';
import { cfg } from '../config.js';

// A small pool: shared hosts cap concurrent MySQL connections per user.
export const pool = mysql.createPool({
  ...cfg.db,
  connectionLimit: 5,
  charset: 'utf8mb4',
  timezone: 'Z',
  dateStrings: true,
  namedPlaceholders: false,
});

// All timestamps are stored as UTC; the browser shows them in local time.
pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));

export async function q(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function one(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0] || null;
}

export async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn({
      q: async (sql, params = []) => (await conn.query(sql, params))[0],
    });
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
