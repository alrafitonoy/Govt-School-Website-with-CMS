// Local development database. Runs the portable MariaDB in .localdb on 127.0.0.1 only.
// First run: initialises the data folder, writes a development .env with random secrets,
// and creates the database and its user. Stays running until you press Ctrl+C.
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = path.join(root, '.localdb');
const bin = path.join(home, 'mariadb', 'bin');
const data = path.join(home, 'data');
const envFile = path.join(root, '.env');
const PORT = 3307;

if (!fs.existsSync(path.join(bin, 'mariadbd.exe'))) {
  console.error('MariaDB was not found in .localdb/mariadb. Use XAMPP or another MySQL server instead, as described in the README.');
  process.exit(1);
}

const secret = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

if (!fs.existsSync(envFile)) {
  fs.writeFileSync(envFile, [
    'NODE_ENV=development',
    'PORT=5000',
    'PUBLIC_URL=http://localhost:5000',
    'DB_HOST=127.0.0.1',
    `DB_PORT=${PORT}`,
    'DB_NAME=school_cms',
    'DB_USER=school_user',
    `DB_PASSWORD=${secret(24)}`,
    `APP_SECRET=${secret(48)}`,
    `SETUP_KEY=${secret(12)}`,
    'TRUST_PROXY=0',
    'FORCE_HTTPS=false',
    '',
  ].join('\n'));
  console.log('Created .env with development settings.');
}
const env = dotenv.parse(fs.readFileSync(envFile));

if (!fs.existsSync(path.join(data, 'mysql'))) {
  fs.mkdirSync(data, { recursive: true });
  const init = spawnSync(path.join(bin, 'mariadb-install-db.exe'), [`--datadir=${data}`, `--port=${PORT}`, '--silent'], { stdio: 'inherit' });
  if (init.status !== 0) process.exit(init.status || 1);
}

const server = spawn(path.join(bin, 'mariadbd.exe'), [`--defaults-file=${path.join(data, 'my.ini')}`, `--port=${PORT}`, '--bind-address=127.0.0.1'], { stdio: 'ignore' });
server.on('exit', (code) => {
  console.log(`Database stopped (code ${code}).`);
  process.exit(code || 0);
});
const stop = () => server.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

const portOpen = () => new Promise((resolve) => {
  const s = net.connect(PORT, '127.0.0.1', () => { s.destroy(); resolve(true); });
  s.on('error', () => resolve(false));
});
for (let i = 0; !(await portOpen()); i++) {
  if (i > 60) {
    console.error('The database did not start in time.');
    stop();
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 500));
}

// root has no password here, which is safe only because the server accepts local connections alone.
const conn = await mysql.createConnection({ host: '127.0.0.1', port: PORT, user: 'root', password: '' });
await conn.query(`CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
for (const host of ['127.0.0.1', 'localhost']) {
  await conn.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', [env.DB_USER, host, env.DB_PASSWORD]);
  await conn.query(`GRANT ALL PRIVILEGES ON \`${env.DB_NAME}\`.* TO ?@?`, [env.DB_USER, host]);
}
await conn.end();
console.log(`Database ready on 127.0.0.1:${PORT}, database "${env.DB_NAME}". Press Ctrl+C to stop it.`);
