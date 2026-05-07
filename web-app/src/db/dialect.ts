// Detect dialect once at boot. Postgres if DATABASE_URL looks like a postgres
// connection string; otherwise fall back to a local Bun-managed SQLite file.
const url = process.env.DATABASE_URL ?? '';
const looksPg = url.startsWith('postgres://') || url.startsWith('postgresql://');

export const dialect: 'pg' | 'sqlite' = looksPg ? 'pg' : 'sqlite';

// Where the local sqlite file lives when the dialect is sqlite. Resolved here
// so migrate / runtime / drizzle-kit all agree.
export const SQLITE_PATH = process.env.SQLITE_PATH ?? './db.sqlite';

// PG connection string (only meaningful when dialect === 'pg').
export const PG_URL = url || 'postgres://drift:drift@localhost:5432/drift';
