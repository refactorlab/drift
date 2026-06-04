import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { driftAlias } from './build/alias';

export default defineConfig({
  // The React plugin gives JSX/TSX transform so component tests can render.
  plugins: [react()],
  // Same renderer/fixture/fs aliases as the build so tests exercise the real
  // action renderer (single source of truth), not a fork.
  resolve: { alias: driftAlias },
  // Tests run as a non-store build so the remote-download path is present +
  // exercisable (see scannerDownload.test). Mirrors vite.config's define.
  define: {
    __DRIFT_STORE_BUILD__: 'false',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
