import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { openAPIRouteHandler } from 'hono-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

import scans from './routes/scans.ts';
import prs from './routes/prs.ts';
import improvements from './routes/improvements.ts';
import architecture from './routes/architecture.ts';
import repos from './routes/repos.ts';
import users from './routes/users.ts';
import departments from './routes/departments.ts';
import dashboard from './routes/dashboard.ts';
import auth from './routes/auth.ts';
import ingest from './routes/ingest.ts';
import githubWebhooks from './routes/github-webhooks.ts';
import { requireAuth } from './auth/middleware.ts';

const app = new Hono();

app.use(
  '/api/*',
  cors({
    credentials: true,
    origin: ['http://localhost:5173', 'http://localhost:8000'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.get('/healthcheck', (c) => c.json({ ok: true }));

app.route('/api/auth', auth);

// Bearer-token + HMAC routes — must mount BEFORE the cookie auth gate below.
app.route('/api/ingest', ingest);
app.route('/api/github', githubWebhooks);

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

// Resolve web/dist relative to cwd so the same code works for `bun run start`
// (cwd = web-app/) and for Vercel functions (cwd = deployment root, with
// web/dist bundled via vercel.json `includeFiles`).
const DIST = process.env.WEB_DIST_DIR ?? path.resolve(process.cwd(), 'web/dist');
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
  const safe = filePath.startsWith(DIST) && existsSync(filePath) ? filePath : INDEX;
  // Use node:fs so this works both under Bun (Vercel + local) and any
  // non-Bun runtime that might import this module.
  const buf = readFileSync(safe);
  const ext = path.extname(safe).toLowerCase();
  const type =
    ext === '.html' ? 'text/html; charset=utf-8'
    : ext === '.js' ? 'application/javascript; charset=utf-8'
    : ext === '.css' ? 'text/css; charset=utf-8'
    : ext === '.json' ? 'application/json'
    : ext === '.svg' ? 'image/svg+xml'
    : ext === '.png' ? 'image/png'
    : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : 'application/octet-stream';
  return new Response(new Uint8Array(buf), { headers: { 'content-type': type } });
});

export default app;
