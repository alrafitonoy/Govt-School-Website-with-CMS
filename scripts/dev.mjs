// Runs the API and the Vite dev server together.
import { spawn } from 'node:child_process';

const run = (cmd, args) => spawn(cmd, args, { stdio: 'inherit', shell: true });
const procs = [
  run('node', ['--watch', 'server.js']),
  run('npx', ['vite']),
];
const stop = () => procs.forEach((p) => p.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
