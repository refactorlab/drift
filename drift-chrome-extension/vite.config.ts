import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';
import { driftAlias, fsStubAlias, driftFsAllow } from './build/alias';

// HMR for the live-voice FSM binary. voiceAudio.ts imports volley_core_bg.wasm
// via `?url` — a STATIC ASSET, not part of the JS module graph. When the
// volley-core watcher (scripts/watch-voice-wasm.mjs) rebuilds after a Rust edit
// that changed FSM *logic* but no exported wasm-bindgen signature, the `.js`
// glue comes out byte-identical and ONLY the `.wasm` bytes change — so Vite has
// nothing in the graph to invalidate and the side panel keeps running the stale
// FSM. handleHotUpdate fires for any watched file, so we catch the binary
// directly and force a full reload, making a Rust edit reload the live agent.
function voiceWasmHmr(): Plugin {
  const WASM = resolve(__dirname, 'src/vendor/volley/volley_core_bg.wasm');
  return {
    name: 'drift:voice-wasm-hmr',
    handleHotUpdate({ file, server }) {
      if (file !== WASM) return;
      server.config.logger.info('voice wasm changed → full reload', { timestamp: true });
      server.ws.send({ type: 'full-reload' });
      return []; // we handled it; no module-graph update to propagate
    },
  };
}

export default defineConfig({
  plugins: [react(), crx({ manifest }), voiceWasmHmr()],
  resolve: { alias: [...driftAlias, ...fsStubAlias] },
  // Distribution profile. The STORE build (DRIFT_STORE_BUILD=1, set by the
  // Chrome Web Store publish workflow) statically flips this to `true`, which
  // dead-code-eliminates the remote-scanner-download path (Settings row +
  // scannerDownload.ts) so the shipping package contains NO fetch-remote-wasm
  // code — the pattern MV3 reviewers reject. Any other build (dev / sideload)
  // leaves it `false` and keeps the download override. verify-store-build.mjs
  // asserts the store bundle is actually clean.
  define: {
    __DRIFT_STORE_BUILD__: JSON.stringify(process.env.DRIFT_STORE_BUILD === '1'),
  },
  // ttsWorker.ts dynamic-imports @huggingface/transformers + kokoro-js, so the
  // worker must be a code-split ES module (Vite's default IIFE worker format
  // can't do code-splitting). MV3 loads it via `new Worker(url, {type:'module'})`.
  worker: { format: 'es' },
  // CRXJS serves the content-script HMR client over this port in dev.
  server: {
    port: 5181,
    strictPort: false,
    cors: { origin: [/chrome-extension:\/\//] },
    // The renderer is bundled from ../action (outside this package root).
    fs: { allow: driftFsAllow },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      // The mic-permission tab (src/permission) is a standalone extension page
      // opened via chrome.tabs.create — it isn't referenced by the manifest, so
      // it's added here as an explicit HTML input. CRXJS merges its own inputs.
      input: { permission: resolve(__dirname, 'src/permission/index.html') },
    },
  },
});
