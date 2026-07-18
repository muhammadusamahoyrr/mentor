#!/usr/bin/env node
// Runs every backend service in one terminal.
//
//   node dev.js            all services
//   node dev.js auth notes only the ones you name (substring match)
//
// Spawns `node src/server.js` directly rather than `npm start`: audit-service
// has no start script, and going through npm would add a shell per service for
// no gain. Ctrl+C stops all of them.

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SERVICES = [
  { name: 'auth',         dir: 'auth-service',         port: 3001 },
  { name: 'appointment',  dir: 'appointment-service',  port: 3002 },
  { name: 'notification', dir: 'notification-service', port: 3003 },
  { name: 'file',         dir: 'file-service',         port: 3005 },
  { name: 'notes',        dir: 'notes-service',        port: 3006 },
  { name: 'agent',        dir: 'agent-service',        port: 3007 },
  // Kafka consumer, not an HTTP server -- it has no port to listen on.
  { name: 'audit',        dir: 'audit-service',        port: null },
];

const COLORS = [36, 32, 35, 33, 34, 31, 90]; // cyan, green, magenta, yellow, blue, red, grey
const paint = (code, s) => `\x1b[${code}m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const filters = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const selected = filters.length
  ? SERVICES.filter((s) => filters.some((f) => s.name.includes(f) || s.dir.includes(f)))
  : SERVICES;

if (!selected.length) {
  console.error(`No service matches ${filters.join(', ')}.`);
  console.error(`Known: ${SERVICES.map((s) => s.name).join(', ')}`);
  process.exit(1);
}

// A service with no node_modules dies instantly on require() with a stack trace
// that buries the real cause. Say it plainly up front instead.
const missing = selected.filter(
  (s) => !fs.existsSync(path.join(__dirname, 'services', s.dir, 'node_modules'))
);
if (missing.length) {
  console.error(paint(31, 'Dependencies are not installed for:'));
  for (const s of missing) console.error(`  ${s.dir}`);
  console.error('\nInstall them first:');
  console.error(dim(`  cd Backend/services/${missing[0].dir} && npm install`));
  process.exit(1);
}

const width = Math.max(...selected.map((s) => s.name.length));
const children = [];
let shuttingDown = false;

selected.forEach((service, i) => {
  const color = COLORS[i % COLORS.length];
  const label = paint(color, service.name.padEnd(width));
  const cwd = path.join(__dirname, 'services', service.dir);

  // process.execPath, not 'node': guarantees the children run on the same
  // Node as this script even when PATH resolves to a different one.
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const relay = (stream, isError) => {
    let buffered = '';
    stream.on('data', (chunk) => {
      buffered += chunk.toString();
      const lines = buffered.split('\n');
      buffered = lines.pop(); // hold the partial line until its newline arrives
      for (const line of lines) {
        const text = isError ? paint(31, line) : line;
        console.log(`${label} ${dim('│')} ${text}`);
      }
    });
  };
  relay(child.stdout, false);
  relay(child.stderr, true);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const why = signal ? `signal ${signal}` : `code ${code}`;
    console.log(`${label} ${dim('│')} ${paint(31, `exited (${why})`)}`);
  });

  child.on('error', (err) => {
    console.log(`${label} ${dim('│')} ${paint(31, `failed to start: ${err.message}`)}`);
  });

  children.push(child);
});

console.log(dim('─'.repeat(60)));
for (const s of selected) {
  const where = s.port ? `http://localhost:${s.port}` : 'kafka consumer (no port)';
  console.log(`  ${s.name.padEnd(width)} ${dim('→')} ${where}`);
}
console.log(dim('─'.repeat(60)));
console.log(dim('Ctrl+C to stop all.\n'));

const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(dim('\nStopping services...'));
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
  // Don't hang forever on a service that ignores SIGTERM.
  setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    process.exit(0);
  }, 5000).unref();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
