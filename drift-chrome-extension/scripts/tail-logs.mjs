#!/usr/bin/env node
// Stream the extension's *runtime* console into your terminal.
//
// MV3 logs live in three separate DevTools consoles — the side-panel React app,
// the background service worker, and the content script on github.com — so you
// normally need three open inspector windows to watch them. This launches a
// dedicated Chrome (its own profile, the built dist/ loaded unpacked) with the
// DevTools Protocol enabled and tails console.* + uncaught errors from all of
// them into one colorized stream.
//
// Zero deps: Node ≥ 22 ships global `fetch` + `WebSocket`.
//
//   node scripts/tail-logs.mjs            # side panel + service worker
//   ALL=1 node scripts/tail-logs.mjs      # also include github.com pages (content script)
//   PORT=9333 CHROME=/path/to/chrome node scripts/tail-logs.mjs
//
// Then click the Drift toolbar icon to open the side panel — its target is
// picked up automatically as soon as it exists.

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PORT = Number(process.env.PORT || 9333);
const INCLUDE_PAGES = process.env.ALL === '1';
const DIST = resolve(import.meta.dirname, '..', 'dist');

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m',
};

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find(existsSync);
}

function die(msg) {
  console.error(`${C.red}✗${C.reset} ${msg}`);
  process.exit(1);
}

if (!existsSync(DIST)) {
  die(`dist/ not found — build the extension first:\n    make build   (or run \`make dev\` in another terminal)`);
}
const chrome = findChrome();
if (!chrome) {
  die('Chrome not found. Set CHROME=/path/to/Google\\ Chrome and retry.');
}

// Dedicated throwaway profile so we never touch the user's real Chrome.
const userDataDir = mkdtempSync(join(tmpdir(), 'drift-logs-'));

console.log(`${C.cyan}▶${C.reset} launching Chrome (profile: ${C.dim}${userDataDir}${C.reset})`);
const proc = spawn(chrome, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${userDataDir}`,
  `--load-extension=${DIST}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-features=DisableLoadExtensionCommandLineSwitch',
  'https://github.com',
], { stdio: 'ignore' });

proc.on('exit', () => process.exit(0));

const cleanup = () => { try { proc.kill(); } catch {} process.exit(0); };
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// ── target discovery + per-target attachment ───────────────────────────────
const connected = new Map(); // targetId -> WebSocket

function labelFor(t) {
  if (t.type === 'service_worker') return { name: 'worker', color: C.magenta };
  if (t.url?.includes('/sidepanel/')) return { name: 'sidepanel', color: C.green };
  if (t.url?.startsWith('chrome-extension://')) {
    const tail = t.url.split('/').pop()?.replace(/\.html.*/, '') || 'ext';
    return { name: tail, color: C.cyan };
  }
  return { name: 'page', color: C.blue };
}

function wanted(t) {
  if (t.url?.startsWith('chrome-extension://')) return true;
  if (t.type === 'service_worker' && t.url?.startsWith('chrome-extension://')) return true;
  if (INCLUDE_PAGES && t.type === 'page' && t.url?.startsWith('http')) return true;
  return false;
}

const levelColor = { error: C.red, warning: C.yellow, info: C.blue, log: C.reset, debug: C.gray };

function ts() {
  // Locale time without bringing in a dep; HH:MM:SS.
  return new Date().toTimeString().slice(0, 8);
}

function render(arg) {
  if (arg == null) return String(arg);
  if (arg.type === 'string') return arg.value;
  if ('value' in arg) return typeof arg.value === 'object' ? JSON.stringify(arg.value) : String(arg.value);
  if (arg.unserializableValue) return arg.unserializableValue;
  if (arg.preview) {
    if (arg.preview.subtype === 'array' || arg.subtype === 'array') {
      return `[${arg.preview.properties.map((p) => p.value).join(', ')}]`;
    }
    const props = arg.preview.properties.map((p) => `${p.name}: ${p.value}`).join(', ');
    return `${arg.className || ''}{ ${props} }${arg.preview.overflow ? ' …' : ''}`;
  }
  return arg.description || arg.className || arg.type;
}

function emit(label, level, parts, loc) {
  const col = levelColor[level] ?? C.reset;
  const tag = `${label.color}${label.name.padEnd(9)}${C.reset}`;
  const lvl = level === 'log' ? '' : `${col}${level}${C.reset} `;
  const where = loc ? ` ${C.gray}${loc}${C.reset}` : '';
  console.log(`${C.gray}${ts()}${C.reset} ${tag} ${lvl}${col}${parts}${C.reset}${where}`);
}

async function attach(target) {
  if (connected.has(target.id) || !target.webSocketDebuggerUrl) return;
  const label = labelFor(target);
  let ws;
  try {
    ws = new WebSocket(target.webSocketDebuggerUrl);
  } catch {
    return;
  }
  connected.set(target.id, ws);

  let msgId = 1;
  const send = (method, params) => ws.send(JSON.stringify({ id: msgId++, method, params }));

  ws.addEventListener('open', () => {
    emit(label, 'info', `▸ attached (${target.type})`, target.url);
    send('Runtime.enable');
    send('Log.enable');
  });

  ws.addEventListener('message', (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (m.method === 'Runtime.consoleAPICalled') {
      const { type, args = [], stackTrace } = m.params;
      const text = args.map(render).join(' ');
      const top = stackTrace?.callFrames?.[0];
      const loc = top ? `${top.url.split('/').pop()}:${top.lineNumber + 1}` : '';
      emit(label, type === 'warning' ? 'warning' : type, text, loc);
    } else if (m.method === 'Log.entryAdded') {
      const e = m.params.entry;
      const loc = e.url ? `${e.url.split('/').pop()}:${e.lineNumber ?? ''}` : '';
      emit(label, e.level === 'warning' ? 'warning' : e.level, e.text, loc);
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      const text = d.exception?.description || d.text;
      const loc = d.url ? `${d.url.split('/').pop()}:${(d.lineNumber ?? 0) + 1}` : '';
      emit(label, 'error', text, loc);
    }
  });

  ws.addEventListener('close', () => {
    if (connected.get(target.id) === ws) connected.delete(target.id);
    emit(label, 'warning', '▸ detached', target.url);
  });
  ws.addEventListener('error', () => {});
}

async function poll() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json`);
    const targets = await res.json();
    for (const t of targets) if (wanted(t)) attach(t);
  } catch {
    // Chrome's debug endpoint not up yet — retry on the next tick.
  }
}

console.log(`${C.cyan}▶${C.reset} tailing ${C.bold}${INCLUDE_PAGES ? 'extension + github.com pages' : 'side panel + service worker'}${C.reset} — open the side panel by clicking the Drift icon.`);
console.log(`${C.gray}  (Ctrl-C to stop; closes this Chrome and deletes its temp profile)${C.reset}\n`);

await poll();
setInterval(poll, 1000);
