import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://drift:drift@localhost:5432/drift';

export const sql = postgres(DATABASE_URL, { max: 10 });
export const db = drizzle(sql, { schema });

export { schema };
