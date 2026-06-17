import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';
import { driftAlias, fsStubAlias, driftFsAllow } from './build/alias';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
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
      // The mic-permission page (src/permission/index.html) isn't referenced by
      // any manifest field — it's opened at runtime via chrome.windows.create —
      // so CRXJS won't discover it on its own. List it as an explicit HTML input
      // so it's built and emitted at its source path (which chrome.runtime.getURL
      // resolves, the same way side_panel uses 'src/sidepanel/index.html').
      input: { permission: 'src/permission/index.html' },
    },
  },
});
