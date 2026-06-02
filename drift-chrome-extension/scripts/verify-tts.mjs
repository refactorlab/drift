#!/usr/bin/env node
// End-to-end verification that on-device Kokoro synthesis (a) works against the
// BUNDLED model and (b) runs OFF the main thread so the side panel never freezes.
//
// It launches Chrome with the built dist/ loaded, opens the side-panel page, and
// from that page spawns the REAL built worker (assets/ttsWorker-*.js). It posts
// the same init + synth messages the app posts, then checks:
//   • the worker reaches `ready` (the ~92 MB model loaded from the package)
//   • a synth returns real PCM (samples byteLength > 0)
//   • a main-thread 10 ms timer kept ticking DURING synth (proof the page didn't
//     block — on-main-thread inference would starve the timer to ~0 ticks)
//
// Zero deps (Node ≥ 22 global fetch + WebSocket). Headful, throwaway profile.
//   node scripts/verify-tts.mjs

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const DIST = join(root, 'dist');
const PORT = Number(process.env.PORT || 9444);

const chrome =
  process.env.CHROME ||
  ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(
    existsSync,
  );
if (!chrome) throw new Error('Chrome not found — set CHROME=/path/to/chrome');
if (!existsSync(DIST)) throw new Error('dist/ missing — run `make build` first');

const workerFile = readdirSync(join(DIST, 'assets')).find((f) => /^ttsWorker-.*\.js$/.test(f));
if (!workerFile) throw new Error('no built ttsWorker-*.js in dist/assets — build first');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userDataDir = mkdtempSync(join(tmpdir(), 'drift-verify-'));
const proc = spawn(
  chrome,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    `--load-extension=${DIST}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { stdio: 'ignore' },
);
const cleanup = () => { try { proc.kill(); } catch {} };
process.on('exit', cleanup);

// ── minimal CDP over the browser endpoint ──────────────────────────────────
async function cdp() {
  let ver;
  for (let i = 0; i < 50; i++) {
    try {
      ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      break;
    } catch {
      await sleep(200);
    }
  }
  if (!ver) throw new Error('Chrome DevTools endpoint never came up');
  return ver.webSocketDebuggerUrl;
}

async function extId() {
  for (let i = 0; i < 50; i++) {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    const t = targets.find((x) => String(x.url).startsWith('chrome-extension://'));
    if (t) return new URL(t.url).host;
    await sleep(300);
  }
  throw new Error('extension target never appeared (did dist/ load?)');
}

function rpc(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    }
  });
  return (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
    });
}

// A self-contained extension-origin test page dropped into dist/ (which WAR
// exposes as `**/*`). Side-panel pages can't be opened as a standalone tab, but
// this plain page on the extension origin can — and being same-origin it may
// construct the packaged module worker. CSP forbids inline script, so the page
// loads an external module file. Both are removed after the run.
function writeHarness(workerFile) {
  const js = `const out = { status: 'running' };
window.__ttsResult = out;
(async () => {
  try {
    const t0 = performance.now();
    let ticks = 0; const timer = setInterval(() => ticks++, 10);
    const worker = new Worker(chrome.runtime.getURL('assets/${workerFile}'), { type: 'module' });
    const r = await new Promise((res, rej) => {
      worker.onerror = (e) => rej('worker error: ' + (e.message || 'crash'));
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'ready') worker.postMessage({ type:'synth', id:1, text:'Hello from Drift. This is the on device Kokoro voice running in a worker.', voice:'af_heart', speed:1 });
        else if (m.type === 'result') res({ bytes: m.samples.byteLength, sampleRate: m.sampleRate });
        else if (m.type === 'init-error' || m.type === 'synth-error') rej(m.type + ': ' + m.message);
      };
      worker.postMessage({ type:'init',
        modelBaseUrl: chrome.runtime.getURL('models/'),
        wasmPaths: chrome.runtime.getURL('ort/'),
        voiceBaseUrl: chrome.runtime.getURL('models/onnx-community/Kokoro-82M-v1.0-ONNX/voices/') });
    });
    clearInterval(timer); worker.terminate();
    const elapsed = performance.now() - t0;
    Object.assign(out, { status:'done', ...r, seconds:+((r.bytes/4)/r.sampleRate).toFixed(1), elapsedMs:Math.round(elapsed), ticks, expectedTicks:Math.round(elapsed/10) });
  } catch (e) { Object.assign(out, { status:'error', error:String(e && e.message || e) }); }
})();
`;
  const html = `<!doctype html><meta charset=utf8><title>tts selftest</title><script type="module" src="./zz-verify-tts.js"></script>`;
  writeFileSync(join(DIST, 'zz-verify-tts.js'), js);
  writeFileSync(join(DIST, 'zz-verify-tts.html'), html);
}
const removeHarness = () => {
  for (const f of ['zz-verify-tts.js', 'zz-verify-tts.html']) rmSync(join(DIST, f), { force: true });
};

const main = async () => {
  const wsUrl = await cdp();
  const id = await extId();
  writeHarness(workerFile);
  const pageUrl = `chrome-extension://${id}/zz-verify-tts.html`;
  console.log(`▶ extension id ${id}`);

  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  const send = rpc(ws);

  const { targetId } = await send('Target.createTarget', { url: pageUrl });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);

  console.log('▶ loading the bundled model in the worker + synthesizing (first run ≈ model load)…');
  let r = null;
  for (let i = 0; i < 720; i++) {
    // ~3 min budget
    await sleep(250);
    const ev = await send(
      'Runtime.evaluate',
      { expression: 'window.__ttsResult ? JSON.stringify(window.__ttsResult) : null', returnByValue: true },
      sessionId,
    ).catch(() => null);
    const val = ev?.result?.value;
    if (!val) continue;
    const parsed = JSON.parse(val);
    if (parsed.status === 'done') { r = parsed; break; }
    if (parsed.status === 'error') throw new Error('harness: ' + parsed.error);
  }
  if (!r) throw new Error('timed out waiting for synthesis');
  const responsive = r.ticks > r.expectedTicks * 0.5; // main thread kept at least half its ticks
  console.log('\n── result ───────────────────────────────');
  console.log(`  PCM bytes:        ${r.bytes.toLocaleString()} (${r.seconds}s of ${r.sampleRate} Hz audio)`);
  console.log(`  total elapsed:    ${(r.elapsedMs / 1000).toFixed(1)}s (model load + synth)`);
  console.log(`  main-thread ticks: ${r.ticks} / ~${r.expectedTicks} expected  → ${responsive ? 'RESPONSIVE ✓' : 'BLOCKED ✗'}`);
  console.log('─────────────────────────────────────────');

  const ok = r.bytes > 0 && responsive;
  console.log(ok ? '\n✅ PASS — real Kokoro PCM produced AND the main thread stayed responsive.' : '\n❌ FAIL');
  removeHarness();
  cleanup();
  process.exit(ok ? 0 : 1);
};

main().catch((e) => {
  console.error('✗ ' + (e?.message || e));
  removeHarness();
  cleanup();
  process.exit(1);
});
