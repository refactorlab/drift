import { db, migrate, dropAll, currentSchemaVersion, SCHEMA_VERSION } from './db/index.ts';

console.log('▲ Running migrations…');

const current = currentSchemaVersion();
if (current !== 0 && current !== SCHEMA_VERSION) {
  console.log(`▲ Schema mismatch (db=${current}, code=${SCHEMA_VERSION}); resetting…`);
  dropAll();
}

migrate();

const row = db.prepare('SELECT COUNT(*) AS n FROM scans').get() as { n: number };

if (row.n === 0) {
  console.log('▲ Database empty — seeding initial dataset…');
  await import('./db/seed.ts');
} else {
  console.log(`▲ Skipping seed (${row.n} scans already present)`);
}

console.log('✓ Migrations complete');
