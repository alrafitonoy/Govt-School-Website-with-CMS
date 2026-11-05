// Builds the upload-ready installation ZIP in release/.
// The front end is pre-built, so the host only installs server packages and needs no build step.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const isWin = process.platform === 'win32';

function run(cmd, args, cwd = root) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: isWin && cmd === 'npm' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`);
}

// These packages are only needed to build the front end, which is already done.
const BUILD_ONLY = ['@fontsource-variable/noto-sans-bengali', '@vitejs/plugin-react', 'lucide-react', 'react', 'react-dom', 'react-router-dom', 'vite'];

console.log('Building the front end...');
run('npm', ['run', 'build']);

const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'school-cms-zip-'));
const copy = (from, to = from) => fs.cpSync(path.join(root, from), path.join(stage, to), { recursive: true });
copy('server.js');
copy('server/src');
copy('client/dist');
copy('README.md');
// .env.example stays out on purpose: Hostinger lists it as variables to fill in, but the wizard handles them.
copy('scripts/INSTALL.txt', 'INSTALL.txt');

const dependencies = Object.fromEntries(Object.entries(pkg.dependencies).filter(([name]) => !BUILD_ONLY.includes(name)));
fs.writeFileSync(path.join(stage, 'package.json'), `${JSON.stringify({
  name: pkg.name,
  version: pkg.version,
  private: true,
  description: pkg.description,
  type: 'module',
  main: 'server.js',
  engines: pkg.engines,
  scripts: { start: 'node server.js' },
  dependencies,
  optionalDependencies: pkg.optionalDependencies,
}, null, 2)}\n`);

// A lock file makes the host install exactly the versions this release was tested with.
run('npm', ['install', '--package-lock-only', '--no-audit', '--no-fund'], stage);

const outDir = path.join(root, 'release');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `school-cms-install-${pkg.version}.zip`);
fs.rmSync(out, { force: true });

// Windows' own tar writes forward-slash paths, which Linux hosts need. Git's tar cannot write zip files.
if (isWin) run(path.join(process.env.SystemRoot, 'System32', 'tar.exe'), ['-a', '-c', '-f', out, '-C', stage, ...fs.readdirSync(stage)]);
else run('zip', ['-r', '-q', out, ...fs.readdirSync(stage)], stage);

fs.rmSync(stage, { recursive: true, force: true });
console.log(`Created ${path.relative(root, out)} (${(fs.statSync(out).size / 1048576).toFixed(1)} MB)`);
