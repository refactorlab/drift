import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';
import { driftAlias, fsStubAlias, driftFsAllow } from './build/alias';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: { alias: [...driftAlias, ...fsStubAlias] },
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
      // Extra HTML entries CRXJS doesn't pick up from the manifest are added
      // automatically from the manifest fields above; nothing to list here.
    },
  },
});
