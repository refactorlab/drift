import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import { sign, verify } from 'hono/jwt';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import {
  ACCESS_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  JWT_SECRET,
  REFRESH_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
  cookieOptions,
} from '../auth/config.ts';

const auth = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const sessionSchema = z.object({
  authenticated: z.boolean(),
  user: z
    .object({
      id: z.number(),
      email: z.string(),
      name: z.string(),
      role: z.string(),
      initials: z.string(),
    })
    .nullable(),
});

type AccessClaims = {
  sub: number;
  email: string;
  role: string;
  type: 'access';
  exp: number;
};

type RefreshClaims = {
  sub: number;
  type: 'refresh';
  exp: number;
};

async function issueAndSetTokens(
  c: Parameters<Parameters<typeof auth.post>[1]>[0],
  user: { id: number; email: string; role: string },
) {
  const now = Math.floor(Date.now() / 1000);

  const accessClaims: AccessClaims = {
    sub: user.id,
    email: user.email,
    role: user.role,
    type: 'access',
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
  };
  const refreshClaims: RefreshClaims = {
    sub: user.id,
    type: 'refresh',
    exp: now + REFRESH_TOKEN_TTL_SECONDS,
  };

  const access = await sign(accessClaims, JWT_SECRET);
  const refresh = await sign(refreshClaims, JWT_SECRET);

  setCookie(c, ACCESS_COOKIE, access, {
    ...cookieOptions,
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  setCookie(c, REFRESH_COOKIE, refresh, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
    // Refresh cookie is only ever sent to the refresh endpoint — narrows blast
    // radius if any other endpoint reflects cookies (e.g. via XSS gadget).
    path: '/api/auth/refresh',
  });
}

auth.post(
  '/token',
  describeRoute({
    description: 'Log in with email + password. Sets HttpOnly access + refresh cookies.',
    tags: ['Auth'],
    responses: {
      200: { description: 'Logged in' },
      401: { description: 'Invalid credentials' },
    },
  }),
  validator('json', loginSchema),
  async (c) => {
    const { email, password } = c.req.valid('json');

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        initials: users.initials,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Run verify even when the user doesn't exist so the response time
    // doesn't reveal account existence (still cheap with Bun argon2).
    const dummyHash =
      '$argon2id$v=19$m=65536,t=2,p=1$ZHJpZnRkZWNveXNhbHQwMDAw$dummyhashdummyhashdummyhashdummyhashdummyha';
    const ok = await Bun.password.verify(
      password,
      user?.passwordHash ?? dummyHash,
    );

    if (!user || !user.passwordHash || !ok) {
      return c.json({ error: 'invalid credentials' }, 401);
    }

    await issueAndSetTokens(c, {
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return c.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        initials: user.initials,
      },
    });
  },
);

auth.post(
  '/refresh',
  describeRoute({
    description: 'Rotate the access token using a valid refresh cookie.',
    tags: ['Auth'],
    responses: {
      200: { description: 'New access token issued' },
      401: { description: 'Invalid refresh token' },
    },
  }),
  async (c) => {
    const refresh = getCookie(c, REFRESH_COOKIE);
    if (!refresh) return c.json({ error: 'unauthenticated' }, 401);

    let payload: RefreshClaims;
    try {
      const verified = (await verify(refresh, JWT_SECRET, 'HS256')) as RefreshClaims | string;
      if (typeof verified === 'string' || verified.type !== 'refresh') {
        return c.json({ error: 'unauthenticated' }, 401);
      }
      payload = verified;
    } catch {
      return c.json({ error: 'unauthenticated' }, 401);
    }

    const [user] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user) return c.json({ error: 'unauthenticated' }, 401);

    await issueAndSetTokens(c, user);
    return c.json({ ok: true });
  },
);

auth.get(
  '/me',
  describeRoute({
    description: 'Return the current session user, or { authenticated: false }.',
    tags: ['Auth'],
    responses: {
      200: {
        description: 'Session info',
        content: { 'application/json': { schema: resolver(sessionSchema) } },
      },
    },
  }),
  async (c) => {
    const token = getCookie(c, ACCESS_COOKIE);
    if (!token) return c.json({ authenticated: false, user: null });

    try {
      const payload = (await verify(token, JWT_SECRET, 'HS256')) as AccessClaims | string;
      if (typeof payload === 'string' || payload.type !== 'access') {
        return c.json({ authenticated: false, user: null });
      }
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          initials: users.initials,
        })
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);

      if (!user) return c.json({ authenticated: false, user: null });
      return c.json({ authenticated: true, user });
    } catch {
      return c.json({ authenticated: false, user: null });
    }
  },
);

auth.post(
  '/logout',
  describeRoute({
    description: 'Clear session cookies.',
    tags: ['Auth'],
    responses: { 200: { description: 'Logged out' } },
  }),
  (c) => {
    deleteCookie(c, ACCESS_COOKIE, cookieOptions);
    deleteCookie(c, REFRESH_COOKIE, { ...cookieOptions, path: '/api/auth/refresh' });
    return c.json({ ok: true });
  },
);

export default auth;
