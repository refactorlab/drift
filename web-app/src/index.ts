import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { openAPIRouteHandler } from 'hono-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import path from 'node:path';
import { existsSync } from 'node:fs';

import scans from './routes/scans.ts';
import prs from './routes/prs.ts';
import improvements from './routes/improvements.ts';
import architecture from './routes/architecture.ts';
import repos from './routes/repos.ts';
import users from './routes/users.ts';
import departments from './routes/departments.ts';
import dashboard from './routes/dashboard.ts';
import auth from './routes/auth.ts';
import { requireAuth } from './auth/middleware.ts';

const app = new Hono();

app.use(
  '/api/*',
  cors({
    credentials: true,
    origin: ['http://localhost:5173', 'http://localhost:5000'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.get('/healthcheck', (c) => c.json({ ok: true }));

app.route('/api/auth', auth);

// Everything else under /api/* requires a valid access cookie.
app.use('/api/*', requireAuth);

app.route('/api/scans', scans);
app.route('/api/prs', prs);
app.route('/api/improvements', improvements);
app.route('/api/architecture-suggestions', architecture);
app.route('/api/repos', repos);
app.route('/api/users', users);
app.route('/api/departments', departments);
app.route('/api/dashboard', dashboard);

app.get(
  '/openapi',
  openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: 'Drift API',
        version: '1.0.0',
        description:
          'Performance profiling reports and PR improvement tracking. All numbers come from SQLite and are exposed as JSON.',
      },
      servers: [{ url: '/', description: 'Current server' }],
      tags: [
        { name: 'Dashboard', description: 'Aggregated overview metrics' },
        { name: 'Scans', description: 'PR scan reports — flame graphs, gates, traces' },
        { name: 'PRs', description: 'Pull-request listing & metadata edits' },
        { name: 'Improvements', description: 'PR improvement rollups (PR → Repo → Department → Company)' },
        { name: 'Architecture', description: 'Large-scale architecture proposals' },
        { name: 'Repos', description: 'Repository inventory' },
        { name: 'Departments', description: 'Engineering departments' },
        { name: 'Users', description: 'Users / engineers' },
      ],
    },
  }),
);

app.get('/docs', swaggerUI({ url: '/openapi', persistAuthorization: true }));

const DIST = path.resolve(import.meta.dir, '../web/dist');
const INDEX = path.join(DIST, 'index.html');

app.get('/*', async (c) => {
  if (!existsSync(INDEX)) {
    return c.json(
      { error: 'web/dist not built — run `bun run build` (or use Vite at :5173 in dev)' },
      503,
    );
  }
  const url = new URL(c.req.url);
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.join(DIST, requested);
  const safe = filePath.startsWith(DIST) ? filePath : INDEX;
  const file = Bun.file(safe);
  if (await file.exists()) return new Response(file);
  return new Response(Bun.file(INDEX));
});

const port = Number(process.env.PORT ?? 5000);
console.log(`▲ Drift on http://localhost:${port}  (docs: /docs)`);

export default {
  port,
  fetch: app.fetch,
};
