import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Files in `public/` aren't watched for HMR by Vite. That means when
// `make scan /path` rewrites `public/fixtures/custom.json` in dev,
// the open viewer tab keeps rendering the old JSON until the user
// hard-refreshes. This plugin watches the fixtures directory and
// emits a full-reload over the Vite WebSocket whenever a fixture
// file changes, so `make scan` → tab refreshes automatically.
function watchFixtures(): Plugin {
  return {
    name: 'drift-watch-fixtures',
    apply: 'serve', // only active in `vite dev`, not in production builds
    configureServer(server) {
      const fixturesDir = path.resolve(server.config.root, 'public/fixtures');
      server.watcher.add(fixturesDir);
      const onChange = (changed: string) => {
        if (!changed.startsWith(fixturesDir)) return;
        if (!changed.endsWith('.json')) return;
        server.config.logger.info(
          `[drift-watch-fixtures] ${path.basename(changed)} changed — triggering full-reload`,
          { timestamp: true },
        );
        server.ws.send({ type: 'full-reload', path: '*' });
      };
      server.watcher.on('change', onChange);
      server.watcher.on('add', onChange);
    },
  };
}

export default defineConfig({
  plugins: [react(), watchFixtures()],
  server: { port: 5180, strictPort: false },
});
