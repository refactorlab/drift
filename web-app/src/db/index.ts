import * as schema from './schema.ts';
import { dialect, SQLITE_PATH, PG_URL } from './dialect.ts';

type AnyDb = any;

let _db: AnyDb;
let _close: () => Promise<void>;
let _execRaw: (sql: string) => Promise<void> | void;

if (dialect === 'pg') {
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const postgres = (await import('postgres')).default;
  const sqlClient = postgres(PG_URL, { max: 10 });
  _db = drizzle(sqlClient, { schema });
  _execRaw = async (s) => {
    await sqlClient.unsafe(s);
  };
  _close = async () => {
    await sqlClient.end();
  };
} else {
  const { Database } = await import('bun:sqlite');
  const { drizzle } = await import('drizzle-orm/bun-sqlite');

  // Strip Postgres-only `::int|::bigint|::text|::real` casts before SQLite
  // sees them. The casts are scattered across raw `sql\`…\`` snippets in the
  // route layer — this lets the same code run unmodified against both dialects.
  // SQLite already returns integers from COUNT/SUM, so removing the cast is
  // semantically a no-op.
  const PG_CAST = /::(int|integer|bigint|text|real|float|double precision)\b/gi;
  const PUBLIC_PREFIX = /\bpublic\./g;
  const _prepare = Database.prototype.prepare;
  Database.prototype.prepare = function (sql: string, ...rest: any[]) {
    const cleaned = sql.replace(PG_CAST, '').replace(PUBLIC_PREFIX, '');
    return (_prepare as any).call(this, cleaned, ...rest);
  };

  // Try read/write first (local dev, Vercel build step); fall back to
  // readonly if the filesystem rejects writes (Vercel function runtime).
  // The DB file must already exist in readonly mode — it's created and
  // seeded at build time and bundled with the function via vercel.json
  // `includeFiles`.
  let sqlite: InstanceType<typeof Database>;
  let isReadonly = false;
  try {
    sqlite = new Database(SQLITE_PATH, { create: true });
    sqlite.exec('PRAGMA journal_mode = WAL;');
  } catch {
    sqlite = new Database(SQLITE_PATH, { readonly: true });
    isReadonly = true;
  }
  sqlite.exec('PRAGMA foreign_keys = ON;');
  if (isReadonly) {
    console.log(`▲ SQLite opened read-only at ${SQLITE_PATH}`);
  }
  _db = drizzle(sqlite, { schema });
  // Compat: routes call `db.execute(sql\`…\`)` (a postgres-js drizzle method)
  // for raw queries returning rows. The sqlite driver exposes `.all()` for the
  // same thing — alias so route code is dialect-agnostic.
  if (!_db.execute) _db.execute = (q: any) => _db.all(q);
  _execRaw = (s) => {
    sqlite.exec(s);
  };
  _close = async () => {
    sqlite.close();
  };
}

export const db: AnyDb = _db;
export const closeDb = _close;
export const execRaw = _execRaw;
export { schema, dialect };

// Back-compat: `migrate.ts` currently does `await sql.end()` against the pg
// client. Keep that export shape working, no-op for sqlite.
export const sql = {
  end: async () => {
    await _close();
  },
};
