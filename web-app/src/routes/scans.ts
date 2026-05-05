import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { ScanDetailSchema, ScanListItemSchema } from '../schemas.ts';

const scans = new Hono();

type PRRow = {
  id: number;
  number: number;
  title: string;
  branch: string;
  base_branch: string;
  commits: number;
  files_changed: number;
  author: string;
  status: 'pending' | 'approved' | 'merged';
  github_url: string;
  repo_id: number;
  owner: string;
  repo_name: string;
};

type ScanRow = {
  id: number;
  pr_id: number;
  verdict: string;
  verdict_sub: string;
  profiled_at: number;
  p95_latency_ms: number;
  p95_baseline_ms: number;
  cpu_pct: number;
  cpu_baseline_pct: number;
  db_queries: number;
  db_n_plus_one: number;
  cache_hit_rate: number;
  cache_baseline: number;
  autofix_count: number;
  autofix_total: number;
  autofix_savings_ms: number;
};

function getPR(prNumber: number): PRRow | null {
  return db
    .prepare(
      `SELECT pr.id, pr.number, pr.title, pr.branch, pr.base_branch,
              pr.commits, pr.files_changed, pr.author, pr.status, pr.github_url,
              pr.repo_id, r.owner, r.name AS repo_name
       FROM pull_requests pr
       JOIN repos r ON r.id = pr.repo_id
       WHERE pr.number = ?`,
    )
    .get(prNumber) as PRRow | null;
}

function getLatestScan(prId: number): ScanRow | null {
  return db
    .prepare(`SELECT * FROM scans WHERE pr_id = ? ORDER BY id DESC LIMIT 1`)
    .get(prId) as ScanRow | null;
}

scans.get(
  '/',
  describeRoute({
    description: 'List all PR scans (most recent scan per PR)',
    tags: ['Scans'],
    responses: {
      200: {
        description: 'List of scans',
        content: {
          'application/json': { schema: resolver(z.array(ScanListItemSchema)) },
        },
      },
    },
  }),
  (c) => {
    const rows = db
      .prepare(
        `SELECT pr.number AS prNumber, pr.title AS prTitle, pr.status AS prStatus,
                pr.author,
                r.id AS repoId, r.owner, r.name AS repoName,
                s.verdict, s.verdict_sub AS verdictSub, s.profiled_at AS profiledAt,
                s.p95_latency_ms AS p95LatencyMs, s.p95_baseline_ms AS p95BaselineMs,
                s.cpu_pct AS cpuPct, s.cache_hit_rate AS cacheHitRate
         FROM pull_requests pr
         JOIN repos r ON r.id = pr.repo_id
         JOIN scans s ON s.id = (
           SELECT id FROM scans WHERE pr_id = pr.id ORDER BY id DESC LIMIT 1
         )
         ORDER BY s.profiled_at DESC`,
      )
      .all() as Array<{
        prNumber: number; prTitle: string; prStatus: string; author: string;
        repoId: number; owner: string; repoName: string;
        verdict: string; verdictSub: string; profiledAt: number;
        p95LatencyMs: number; p95BaselineMs: number; cpuPct: number; cacheHitRate: number;
      }>;
    return c.json(
      rows.map((r) => ({
        prNumber: r.prNumber,
        prTitle: r.prTitle,
        prStatus: r.prStatus,
        author: r.author,
        repo: { id: r.repoId, owner: r.owner, name: r.repoName },
        verdict: r.verdict,
        verdictSub: r.verdictSub,
        profiledAt: r.profiledAt,
        p95LatencyMs: r.p95LatencyMs,
        p95BaselineMs: r.p95BaselineMs,
        cpuPct: r.cpuPct,
        cacheHitRate: r.cacheHitRate,
      })),
    );
  },
);

scans.get(
  '/:prNumber',
  describeRoute({
    description: 'Get the full scan report for a PR (issues, gates, flame graph, trace)',
    tags: ['Scans'],
    responses: {
      200: {
        description: 'Full scan report',
        content: {
          'application/json': { schema: resolver(ScanDetailSchema) },
        },
      },
      404: { description: 'PR or scan not found' },
    },
  }),
  (c) => {
    const num = Number(c.req.param('prNumber'));
    if (!Number.isFinite(num)) return c.json({ error: 'invalid pr number' }, 400);

    const pr = getPR(num);
    if (!pr) return c.json({ error: 'pr not found' }, 404);
    const scan = getLatestScan(pr.id);
    if (!scan) return c.json({ error: 'no scan for pr' }, 404);

    const issues = db
      .prepare(
        `SELECT id, severity, title, file_path, line_number, meta, category, impact_ms,
                problem, code_before, code_after, code_lang, code_diff_label,
                suggestion_title, suggestion_text
         FROM issues WHERE scan_id = ? ORDER BY sort_order ASC`,
      )
      .all(scan.id);

    const gates = db
      .prepare(
        `SELECT name, value, status FROM gates WHERE scan_id = ? ORDER BY sort_order ASC`,
      )
      .all(scan.id);

    const flameRowRows = db
      .prepare(`SELECT id, depth FROM flame_rows WHERE scan_id = ? ORDER BY depth ASC`)
      .all(scan.id) as Array<{ id: number; depth: number }>;

    const blockStmt = db.prepare(
      `SELECT label, flex, pct, heat FROM flame_blocks WHERE row_id = ? ORDER BY sort_order ASC`,
    );
    const flame = flameRowRows.map((r) => ({
      depth: r.depth,
      blocks: blockStmt.all(r.id),
    }));

    const flameAxis = db
      .prepare(
        `SELECT label, offset_pct FROM flame_axis WHERE scan_id = ? ORDER BY sort_order ASC`,
      )
      .all(scan.id);

    const timeDistribution = db
      .prepare(
        `SELECT name, pct, level FROM time_distribution WHERE scan_id = ? ORDER BY sort_order ASC`,
      )
      .all(scan.id);

    const trace = db
      .prepare(
        `SELECT label, kind, offset_pct, width_pct, time_ms FROM trace_spans WHERE scan_id = ? ORDER BY sort_order ASC`,
      )
      .all(scan.id);

    return c.json({
      pr: {
        number: pr.number,
        title: pr.title,
        branch: pr.branch,
        baseBranch: pr.base_branch,
        commits: pr.commits,
        filesChanged: pr.files_changed,
        author: pr.author,
        githubUrl: pr.github_url,
        status: pr.status,
        repo: { id: pr.repo_id, owner: pr.owner, name: pr.repo_name },
      },
      scan: {
        verdict: scan.verdict,
        verdictSub: scan.verdict_sub,
        profiledAt: scan.profiled_at,
        stats: {
          p95: { value: scan.p95_latency_ms, baseline: scan.p95_baseline_ms },
          cpu: { value: scan.cpu_pct, baseline: scan.cpu_baseline_pct },
          db: { queries: scan.db_queries, nPlusOne: scan.db_n_plus_one },
          cache: { hitRate: scan.cache_hit_rate, baseline: scan.cache_baseline },
        },
        autofix: {
          fixable: scan.autofix_count,
          total: scan.autofix_total,
          savingsMs: scan.autofix_savings_ms,
        },
      },
      issues,
      gates,
      flame: { rows: flame, axis: flameAxis },
      timeDistribution,
      trace,
    });
  },
);

scans.post(
  '/:prNumber/autofix',
  describeRoute({
    description: 'Trigger Drift to open a PR fixing detected issues',
    tags: ['Scans'],
    responses: {
      200: {
        description: 'Fix PR scheduled',
        content: {
          'application/json': {
            schema: resolver(
              z.object({
                ok: z.boolean(),
                message: z.string(),
                estimatedSavingsMs: z.number(),
                fixPrNumber: z.number(),
              }),
            ),
          },
        },
      },
      404: { description: 'PR or scan not found' },
    },
  }),
  (c) => {
    const num = Number(c.req.param('prNumber'));
    const pr = getPR(num);
    if (!pr) return c.json({ error: 'pr not found' }, 404);
    const scan = getLatestScan(pr.id);
    if (!scan) return c.json({ error: 'no scan' }, 404);
    const fixPrNumber = pr.number + 1;
    return c.json({
      ok: true,
      message: `Drift will open PR #${fixPrNumber} fixing ${scan.autofix_count} of ${scan.autofix_total} issues`,
      estimatedSavingsMs: scan.autofix_savings_ms,
      fixPrNumber,
    });
  },
);

export default scans;
