# Drift

Performance reports for your PRs — React SPA + Hono API, backed by Postgres + Drizzle.

## Quick start

```bash
docker compose up --build
```

- Web app: http://localhost:5000
- pgAdmin: http://localhost:5050  (login `admin@example.com` / `admin`)
- Postgres: `localhost:5432`  (`drift` / `drift` / db `drift`)
- API docs: http://localhost:5000/docs

## Demo login

The migrations container creates an admin user on every boot (idempotent upsert with an argon2id-hashed password). Sign in at the web app with:

| Field    | Value              |
|----------|--------------------|
| Email    | `admin@drift.local`|
| Password | `1234`             |

Override via env vars before `docker compose up`:

```bash
export ADMIN_EMAIL=you@example.com
export ADMIN_PASSWORD='your-strong-password'
export JWT_SECRET="$(openssl rand -hex 32)"   # required in production
docker compose up --build
```

## Auth model

- **Access token** — JWT, 15 min TTL, in `drift_access` HttpOnly+Secure+SameSite=Lax cookie.
- **Refresh token** — JWT, 7 day TTL, in `drift_refresh` HttpOnly+Secure cookie scoped to `/api/auth/refresh`.
- **Password hashing** — argon2id via `Bun.password.hash` (constant-time verify).
- **Endpoints** — `POST /api/auth/token`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`.
- **Middleware** — every `/api/*` route except `/api/auth/*` requires a valid access cookie; the SPA shows a login page on 401.
- **Production** — server refuses to boot if `JWT_SECRET` is missing or shorter than 32 chars.

---

Below is the original step-by-step scaffolding guide that produced the initial layout — kept for reference.

---

Here's a complete scaffolding guide for your `web-app` setup. I'll structure it as a step-by-step you can execute.

## Final structure preview

```
web-app/
├── package.json              # Hono server (Bun)
├── tsconfig.json
├── bun.lock
├── db.sqlite                 # SQLite database
├── drizzle.config.ts
├── .env
├── .gitignore
├── src/
│   ├── index.ts              # Hono entry
│   ├── db/
│   │   ├── client.ts         # Bun SQLite + Drizzle
│   │   └── schema.ts         # User table etc.
│   ├── routes/
│   │   ├── auth.ts
│   │   └── users.ts
│   ├── middleware/
│   │   └── auth.ts
│   └── lib/
│       └── env.ts
└── web/                      # React SPA
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── routes/
        │   ├── Home.tsx
        │   ├── Login.tsx
        │   └── Dashboard.tsx
        └── lib/
            └── api.ts
```

---

## Step 1: Prerequisites

```bash
# Install Bun if you haven't
curl -fsSL https://bun.sh/install | bash

# Verify
bun --version   # should be 1.x
```

---

## Step 2: Create the project root

```bash
mkdir web-app
cd web-app
bun init -y
```

This creates `package.json`, `tsconfig.json`, and a stub `index.ts`.

---

## Step 3: Install backend dependencies

```bash
# Hono + middleware
bun add hono
bun add @hono/zod-validator zod

# DB: Drizzle ORM with Bun's native SQLite
bun add drizzle-orm
bun add -d drizzle-kit @types/bun

# Auth helpers (JWT + password hashing)
bun add hono/jwt   # built into hono, no install needed actually
# bcrypt alternative for Bun:
# Bun has Bun.password built-in, no install needed
```

> Note: `bun:sqlite` is built into Bun — no install needed. `Bun.password` is also built-in for hashing.

---

## Step 4: Configure `package.json` (root)

Replace `web-app/package.json` with:

```json
{
  "name": "web-app",
  "module": "src/index.ts",
  "type": "module",
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "dev:web": "cd web && bun run dev",
    "dev:all": "bun run dev & bun run dev:web",
    "build:web": "cd web && bun run build",
    "build": "bun run build:web && bun build src/index.ts --target=bun --outdir=dist",
    "start": "bun run dist/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "bun run src/db/migrate.ts",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "drizzle-orm": "^0.36.0",
    "hono": "^4.6.0",
    "zod": "^3.23.0",
    "@hono/zod-validator": "^0.4.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "drizzle-kit": "^0.28.0",
    "typescript": "^5.6.0"
  }
}
```

---

## Step 5: `tsconfig.json` (root)

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "types": ["bun-types"],
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

---

## Step 6: `.env` and `.gitignore`

`web-app/.env`:
```
DATABASE_URL=./db.sqlite
JWT_SECRET=change-me-to-a-long-random-string
PORT=3000
NODE_ENV=development
```

`web-app/.gitignore`:
```
node_modules
dist
*.sqlite
*.sqlite-journal
.env
.DS_Store
web/dist
```

---

## Step 7: Database — Drizzle schema and client

`src/db/schema.ts`:

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

`src/db/client.ts`:

```ts
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

const sqlite = new Database(process.env.DATABASE_URL ?? './db.sqlite', {
  create: true,
});
sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });
export { schema };
```

`src/db/migrate.ts`:

```ts
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

const sqlite = new Database(process.env.DATABASE_URL ?? './db.sqlite', { create: true });
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: './drizzle' });
console.log('✅ Migrations applied');
```

`drizzle.config.ts` (at root):

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './db.sqlite',
  },
} satisfies Config;
```

---

## Step 8: Auth middleware

`src/middleware/auth.ts`:

```ts
import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import { db } from '@/db/client';
import { users, type User } from '@/db/schema';
import { eq } from 'drizzle-orm';

type AuthContext = {
  Variables: {
    user: User;
  };
};

export const authMiddleware = createMiddleware<AuthContext>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verify(token, process.env.JWT_SECRET!);
    const userId = payload.sub as string;

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return c.json({ error: 'User not found' }, 401);

    c.set('user', user);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

export const requireRole = (role: 'admin' | 'user') =>
  createMiddleware<AuthContext>(async (c, next) => {
    const user = c.get('user');
    if (user.role !== role && user.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  });
```

---

## Step 9: Auth routes

`src/routes/auth.ts`:

```ts
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const auth = new Hono();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

auth.post('/register', zValidator('json', credentialsSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length) return c.json({ error: 'Email already registered' }, 409);

  const passwordHash = await Bun.password.hash(password);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash })
    .returning({ id: users.id, email: users.email, role: users.role });

  const token = await sign(
    { sub: user.id, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 },
    process.env.JWT_SECRET!
  );

  return c.json({ user, token });
});

auth.post('/login', zValidator('json', credentialsSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);

  const ok = await Bun.password.verify(password, user.passwordHash);
  if (!ok) return c.json({ error: 'Invalid credentials' }, 401);

  const token = await sign(
    { sub: user.id, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 },
    process.env.JWT_SECRET!
  );

  return c.json({
    user: { id: user.id, email: user.email, role: user.role },
    token,
  });
});

export { auth };
```

---

## Step 10: User routes

`src/routes/users.ts`:

```ts
import { Hono } from 'hono';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { authMiddleware, requireRole } from '@/middleware/auth';

const userRoutes = new Hono();

userRoutes.use('*', authMiddleware);

userRoutes.get('/me', (c) => {
  const user = c.get('user');
  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
});

userRoutes.get('/', requireRole('admin'), async (c) => {
  const all = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users);
  return c.json(all);
});

export { userRoutes };
```

---

## Step 11: Main Hono entry

`src/index.ts`:

```ts
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { auth } from '@/routes/auth';
import { userRoutes } from '@/routes/users';

const app = new Hono();

app.use('*', logger());
app.use(
  '/api/*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })
);

// API routes
app.route('/api/auth', auth);
app.route('/api/users', userRoutes);

app.get('/api/health', (c) => c.json({ ok: true }));

// Serve React SPA in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', async (c) => {
    const path = c.req.path === '/' ? '/index.html' : c.req.path;
    const file = Bun.file(`./web/dist${path}`);
    if (await file.exists()) {
      return new Response(file);
    }
    // SPA fallback for react-router
    return new Response(Bun.file('./web/dist/index.html'));
  });
}

const port = Number(process.env.PORT ?? 3000);
console.log(`🔥 Hono running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
```

---

## Step 12: Set up the React frontend in `web/`

```bash
cd web-app
bun create vite web --template react-ts
cd web
bun install
bun add react-router-dom
```

Update `web/package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

`web/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
```

---

## Step 13: React app code

`web/src/lib/api.ts`:

```ts
const API_BASE = '/api';

export class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = sessionStorage.getItem('token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) sessionStorage.setItem('token', token);
    else sessionStorage.removeItem('token');
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...options.headers,
      },
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Request failed');
    return res.json();
  }

  login(email: string, password: string) {
    return this.request<{ user: { id: string; email: string; role: string }; token: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    );
  }

  register(email: string, password: string) {
    return this.request<{ user: { id: string; email: string; role: string }; token: string }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    );
  }

  me() {
    return this.request<{ id: string; email: string; name: string | null; role: string }>('/users/me');
  }
}

export const api = new ApiClient();
```

`web/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './routes/Home';
import Login from './routes/Login';
import Dashboard from './routes/Dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
```

`web/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`web/src/routes/Home.tsx`:

```tsx
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Web App</h1>
      <p>
        <Link to="/login">Login</Link> · <Link to="/dashboard">Dashboard</Link>
      </p>
    </div>
  );
}
```

`web/src/routes/Login.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { token } = await api.login(email, password);
      api.setToken(token);
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 360 }}>
      <h1>Login</h1>
      <form onSubmit={submit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Sign in</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

`web/src/routes/Dashboard.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function Dashboard() {
  const [me, setMe] = useState<{ email: string; role: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.me().then(setMe).catch(() => navigate('/login'));
  }, [navigate]);

  if (!me) return <p>Loading…</p>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Dashboard</h1>
      <p>Logged in as {me.email} ({me.role})</p>
      <button onClick={() => { api.setToken(null); navigate('/login'); }}>
        Logout
      </button>
    </div>
  );
}
```

---

## Step 14: Run the migrations and start

```bash
cd web-app

# Generate the first migration from your schema
bun run db:generate

# Apply it (creates db.sqlite with the users table)
bun run db:migrate
```

You should now see `web-app/db.sqlite` and a `drizzle/` folder with the migration SQL.

---

## Step 15: Run in development

Open **two terminals**:

```bash
# Terminal 1 — Hono API on :3000
cd web-app
bun run dev
```

```bash
# Terminal 2 — Vite SPA on :5173 (proxies /api to :3000)
cd web-app/web
bun run dev
```

Visit `http://localhost:5173`. The Vite dev server proxies all `/api/*` calls to Hono, so React Router and HMR work normally.

---

## Step 16: Production build

```bash
cd web-app
bun run build
NODE_ENV=production bun run start
```

Hono now serves both the API (`/api/*`) and the built React SPA from `web/dist` at `http://localhost:3000`, with proper SPA fallback for `react-router-dom`.

---

## What you've got

- ✅ Hono running on Bun at `web-app/`
- ✅ React + Vite + react-router-dom at `web-app/web/`
- ✅ SQLite at `web-app/db.sqlite` via Bun's native driver + Drizzle
- ✅ JWT auth using Hono's built-in JWT + Bun's built-in password hashing
- ✅ User table with role-based middleware (`authMiddleware`, `requireRole`)
- ✅ Vite dev proxy in dev, single-server hosting in prod
- ✅ SPA fallback so React Router routes like `/dashboard` work on refresh

## Recommended next steps

- Swap JWT-in-sessionStorage for **httpOnly cookies** for better security (Hono has `setCookie` helpers)
- Add **CASL** or a roles/permissions table for finer-grained authz
- Add **TanStack Query** in the frontend for caching API calls
- Add a `shared/` package for types if this becomes a monorepo
- Consider **Better-Auth** if you want OAuth, magic links, 2FA out of the box

Want me to add any of these — httpOnly cookies, TanStack Query setup, or a shared types package?