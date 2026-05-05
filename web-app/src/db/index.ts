import { Database } from 'bun:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(import.meta.dir, '../../data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'drift.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export const SCHEMA_VERSION = 2;

export function currentSchemaVersion(): number {
  try {
    const row = db
      .prepare(`SELECT value FROM meta WHERE key = 'schema_version'`)
      .get() as { value: string } | null;
    return row ? Number(row.value) : 0;
  } catch {
    return 0;
  }
}

export function dropAll() {
  const tables = [
    'trace_spans', 'time_distribution', 'flame_axis', 'flame_blocks', 'flame_rows',
    'gates', 'issues', 'scans', 'pull_requests', 'architecture_suggestions',
    'repos', 'users', 'departments', 'meta',
  ];
  for (const t of tables) db.exec(`DROP TABLE IF EXISTS ${t}`);
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      github_username TEXT NOT NULL,
      initials TEXT NOT NULL,
      department_id INTEGER REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      department_id INTEGER REFERENCES departments(id),
      UNIQUE(owner, name)
    );

    CREATE TABLE IF NOT EXISTS pull_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL REFERENCES repos(id),
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      branch TEXT NOT NULL,
      base_branch TEXT NOT NULL,
      commits INTEGER NOT NULL,
      files_changed INTEGER NOT NULL,
      author TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      github_url TEXT NOT NULL,
      improvement TEXT,
      business_value INTEGER NOT NULL DEFAULT 0,
      hours_saved INTEGER NOT NULL DEFAULT 0,
      UNIQUE(repo_id, number)
    );

    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_id INTEGER NOT NULL REFERENCES pull_requests(id),
      verdict TEXT NOT NULL,
      verdict_sub TEXT NOT NULL,
      profiled_at INTEGER NOT NULL,
      p95_latency_ms INTEGER NOT NULL,
      p95_baseline_ms INTEGER NOT NULL,
      cpu_pct INTEGER NOT NULL,
      cpu_baseline_pct INTEGER NOT NULL,
      db_queries INTEGER NOT NULL,
      db_n_plus_one INTEGER NOT NULL,
      cache_hit_rate INTEGER NOT NULL,
      cache_baseline INTEGER NOT NULL,
      autofix_count INTEGER NOT NULL,
      autofix_total INTEGER NOT NULL,
      autofix_savings_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id INTEGER NOT NULL REFERENCES scans(id),
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      file_path TEXT NOT NULL,
      line_number INTEGER,
      meta TEXT,
      category TEXT,
      impact_ms INTEGER NOT NULL,
      problem TEXT,
      code_before TEXT,
      code_after TEXT,
      code_lang TEXT,
      code_diff_label TEXT,
      suggestion_title TEXT,
      suggestion_text TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS gates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id INTEGER NOT NULL REFERENCES scans(id),
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      status TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS flame_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id INTEGER NOT NULL REFERENCES scans(id),
      depth INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flame_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      row_id INTEGER NOT NULL REFERENCES flame_rows(id),
      label TEXT NOT NULL,
      flex REAL NOT NULL,
      pct INTEGER,
      heat TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS flame_axis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id INTEGER NOT NULL REFERENCES scans(id),
      label TEXT NOT NULL,
      offset_pct INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS time_distribution (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id INTEGER NOT NULL REFERENCES scans(id),
      name TEXT NOT NULL,
      pct INTEGER NOT NULL,
      level TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS trace_spans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id INTEGER NOT NULL REFERENCES scans(id),
      label TEXT NOT NULL,
      kind TEXT NOT NULL,
      offset_pct INTEGER NOT NULL,
      width_pct INTEGER NOT NULL,
      time_ms INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS architecture_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      github_url TEXT,
      business_value INTEGER NOT NULL DEFAULT 0,
      hours_saved INTEGER NOT NULL DEFAULT 0,
      repo_id INTEGER REFERENCES repos(id),
      department_id INTEGER REFERENCES departments(id),
      status TEXT NOT NULL DEFAULT 'proposed',
      created_at INTEGER NOT NULL
    );
  `);

  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(String(SCHEMA_VERSION));
}
