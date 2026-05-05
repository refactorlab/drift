import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';
import { ACCESS_COOKIE, JWT_SECRET } from './config.ts';

export type AuthUser = {
  sub: number;
  email: string;
  role: string;
};

/**
 * Verifies the access cookie and attaches the decoded user to the context.
 * Returns 401 if the cookie is missing, malformed, expired, or has the
 * wrong type claim.
 */
export const requireAuth: MiddlewareHandler<{
  Variables: { user: AuthUser };
}> = async (c, next) => {
  const token = getCookie(c, ACCESS_COOKIE);
  if (!token) return c.json({ error: 'unauthenticated' }, 401);

  try {
    const payload = (await verify(token, JWT_SECRET, 'HS256')) as
      | (AuthUser & { type?: string })
      | string;
    if (typeof payload === 'string' || payload.type !== 'access') {
      return c.json({ error: 'unauthenticated' }, 401);
    }
    c.set('user', {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    });
    return next();
  } catch {
    return c.json({ error: 'unauthenticated' }, 401);
  }
};
