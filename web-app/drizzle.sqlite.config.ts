import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema-sqlite.ts',
  out: './drizzle/sqlite',
  dbCredentials: {
    url: process.env.SQLITE_PATH ?? './db.sqlite',
  },
  strict: true,
  verbose: true,
});
