// Dialect-aware schema re-export. Pick PG or SQLite based on DATABASE_URL.
// Both modules export the same set of tables under the same names so route
// code can `import { users, repos, ... } from './schema'` without caring.
import { dialect } from './dialect.ts';

const mod =
  dialect === 'pg'
    ? await import('./schema-pg.ts')
    : await import('./schema-sqlite.ts');

export const departments = mod.departments;
export const users = mod.users;
export const repos = mod.repos;
export const pullRequests = mod.pullRequests;
export const scans = mod.scans;
export const issues = mod.issues;
export const gates = mod.gates;
export const flameRows = mod.flameRows;
export const flameBlocks = mod.flameBlocks;
export const flameAxis = mod.flameAxis;
export const timeDistribution = mod.timeDistribution;
export const traceSpans = mod.traceSpans;
export const architectureSuggestions = mod.architectureSuggestions;
