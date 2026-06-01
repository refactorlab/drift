import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  // CRXJS serves the content-script HMR client over this port in dev.
  server: { port: 5181, strictPort: false, cors: { origin: [/chrome-extension:\/\//] } },
  build: {
    target: 'esnext',
    rollupOptions: {
      // Extra HTML entries CRXJS doesn't pick up from the manifest are added
      // automatically from the manifest fields above; nothing to list here.
    },
  },
});
