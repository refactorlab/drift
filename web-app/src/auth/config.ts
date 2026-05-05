const isProd = process.env.NODE_ENV === 'production';

const rawSecret = process.env.JWT_SECRET;

// Refuse to boot in production without a strong secret. In dev we fall back
// to a deterministic placeholder so local runs work, but never in production.
if (isProd && (!rawSecret || rawSecret.length < 32)) {
  throw new Error(
    'JWT_SECRET must be set to a 32+ character random string in production',
  );
}

export const JWT_SECRET =
  rawSecret ?? 'dev-only-insecure-secret-change-me-please-32chars';

// Short access TTL keeps the blast radius of token theft small; long refresh
// TTL keeps the UX painless. Refresh rotates on every /refresh.
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export const ACCESS_COOKIE = 'drift_access';
export const REFRESH_COOKIE = 'drift_refresh';

export const cookieOptions = {
  httpOnly: true,
  secure: true, // localhost is a secure context, so this works in dev too
  sameSite: 'Lax' as const,
  path: '/',
};
