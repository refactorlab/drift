import { sql as count } from 'drizzle-orm';
import path from 'node:path';
import { db, sql, dialect, execRaw } from './db/index.ts';
import { scans } from './db/schema.ts';
import { seedAdmin, ADMIN_EMAIL } from './db/seed-admin.ts';

console.log(`▲ Running Drizzle migrations (${dialect})…`);

if (dialect === 'pg') {
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  await migrate(db, {
    migrationsFolder: path.resolve(import.meta.dir, '../drizzle'),
  });
} else {
  const { migrate } = await import('drizzle-orm/bun-sqlite/migrator');
  await migrate(db, {
    migrationsFolder: path.resolve(import.meta.dir, '../drizzle/sqlite'),
  });
}

console.log('✓ Migrations complete');

const [{ n }] = await db
  .select({ n: count<number>`count(*)` })
  .from(scans);

if (n === 0) {
  console.log('▲ Database empty — seeding demo dataset…');
  await import('./db/seed.ts');
} else {
  console.log(`▲ Skipping demo seed (${n} scans already present)`);
}

const admin = await seedAdmin();
console.log(
  admin.created
    ? `▲ Created admin user ${ADMIN_EMAIL}`
    : `▲ Updated admin user ${ADMIN_EMAIL}`,
);

if (dialect === 'sqlite') {
  // Flush WAL into the main file and switch journal mode to DELETE so the
  // resulting db.sqlite is self-contained — no -wal/-shm sidecars needed.
  // This is what lets the file be opened read-only on Vercel's serverless FS.
  await execRaw('PRAGMA wal_checkpoint(TRUNCATE)');
  await execRaw('PRAGMA journal_mode = DELETE');
  console.log('▲ SQLite finalized (WAL checkpointed, journal mode = DELETE)');
}

await sql.end();
