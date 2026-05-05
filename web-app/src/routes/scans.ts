import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  pullRequests, repos, scans as scansTable,
  issues as issuesTable, gates as gatesTable,
  flameRows, flameBlocks, flameAxis,
  timeDistribution, traceSpans,
} from '../db/schema.ts';
import { ScanDetailSchema, ScanListItemSchema } from '../schemas.ts';

const scans = new Hono();

async function getPR(prNumber: number) {
  const [row] = await db
    .select({
      id: pullRequests.id,
      number: pullRequests.number,
      title: pullRequests.title,
      branch: pullRequests.branch,
      baseBranch: pullRequests.baseBranch,
      commits: pullRequests.commits,
      filesChanged: pullRequests.filesChanged,
      author: pullRequests.author,
      status: pullRequests.status,
      githubUrl: pullRequests.githubUrl,
      repoId: repos.id,
      owner: repos.owner,
      repoName: repos.name,
    })
    .from(pullRequests)
    .innerJoin(repos, eq(repos.id, pullRequests.repoId))
    .where(eq(pullRequests.number, prNumber))
    .limit(1);
  return row ?? null;
}

async function getLatestScan(prId: number) {
  const [row] = await db
    .select()
    .from(scansTable)
    .where(eq(scansTable.prId, prId))
    .orderBy(desc(scansTable.id))
    .limit(1);
  return row ?? null;
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
  async (c) => {
    const latestScan = db
      .select({
        id: sql<number>`MAX(${scansTable.id})`.as('latest_id'),
        prId: scansTable.prId,
      })
      .from(scansTable)
      .groupBy(scansTable.prId)
      .as('latest_scan');

    const rows = await db
      .select({
        prNumber: pullRequests.number,
        prTitle: pullRequests.title,
        prStatus: pullRequests.status,
        author: pullRequests.author,
        repoId: repos.id,
        repoOwner: repos.owner,
        repoName: repos.name,
        verdict: scansTable.verdict,
        verdictSub: scansTable.verdictSub,
        profiledAt: scansTable.profiledAt,
        p95LatencyMs: scansTable.p95LatencyMs,
        p95BaselineMs: scansTable.p95BaselineMs,
        cpuPct: scansTable.cpuPct,
        cacheHitRate: scansTable.cacheHitRate,
      })
      .from(pullRequests)
      .innerJoin(repos, eq(repos.id, pullRequests.repoId))
      .innerJoin(latestScan, eq(latestScan.prId, pullRequests.id))
      .innerJoin(scansTable, eq(scansTable.id, latestScan.id))
      .orderBy(desc(scansTable.profiledAt));

    return c.json(
      rows.map((r) => ({
        prNumber: r.prNumber,
        prTitle: r.prTitle,
        prStatus: r.prStatus as 'pending' | 'approved' | 'merged',
        author: r.author,
        repo: { id: r.repoId, owner: r.repoOwner, name: r.repoName },
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
  async (c) => {
    const num = Number(c.req.param('prNumber'));
    if (!Number.isFinite(num)) return c.json({ error: 'invalid pr number' }, 400);

    const pr = await getPR(num);
    if (!pr) return c.json({ error: 'pr not found' }, 404);
    const scan = await getLatestScan(pr.id);
    if (!scan) return c.json({ error: 'no scan for pr' }, 404);

    const issues = await db
      .select({
        id: issuesTable.id,
        severity: issuesTable.severity,
        title: issuesTable.title,
        file_path: issuesTable.filePath,
        line_number: issuesTable.lineNumber,
        meta: issuesTable.meta,
        category: issuesTable.category,
        impact_ms: issuesTable.impactMs,
        problem: issuesTable.problem,
        code_before: issuesTable.codeBefore,
        code_after: issuesTable.codeAfter,
        code_lang: issuesTable.codeLang,
        code_diff_label: issuesTable.codeDiffLabel,
        suggestion_title: issuesTable.suggestionTitle,
        suggestion_text: issuesTable.suggestionText,
      })
      .from(issuesTable)
      .where(eq(issuesTable.scanId, scan.id))
      .orderBy(asc(issuesTable.sortOrder));

    const gates = await db
      .select({
        name: gatesTable.name,
        value: gatesTable.value,
        status: gatesTable.status,
      })
      .from(gatesTable)
      .where(eq(gatesTable.scanId, scan.id))
      .orderBy(asc(gatesTable.sortOrder));

    const flameRowRows = await db
      .select({ id: flameRows.id, depth: flameRows.depth })
      .from(flameRows)
      .where(eq(flameRows.scanId, scan.id))
      .orderBy(asc(flameRows.depth));

    const flame = await Promise.all(
      flameRowRows.map(async (r) => ({
        depth: r.depth,
        blocks: await db
          .select({
            label: flameBlocks.label,
            flex: flameBlocks.flex,
            pct: flameBlocks.pct,
            heat: flameBlocks.heat,
          })
          .from(flameBlocks)
          .where(eq(flameBlocks.rowId, r.id))
          .orderBy(asc(flameBlocks.sortOrder)),
      })),
    );

    const axis = await db
      .select({
        label: flameAxis.label,
        offset_pct: flameAxis.offsetPct,
      })
      .from(flameAxis)
      .where(eq(flameAxis.scanId, scan.id))
      .orderBy(asc(flameAxis.sortOrder));

    const timeDist = await db
      .select({
        name: timeDistribution.name,
        pct: timeDistribution.pct,
        level: timeDistribution.level,
      })
      .from(timeDistribution)
      .where(eq(timeDistribution.scanId, scan.id))
      .orderBy(asc(timeDistribution.sortOrder));

    const trace = await db
      .select({
        label: traceSpans.label,
        kind: traceSpans.kind,
        offset_pct: traceSpans.offsetPct,
        width_pct: traceSpans.widthPct,
        time_ms: traceSpans.timeMs,
      })
      .from(traceSpans)
      .where(eq(traceSpans.scanId, scan.id))
      .orderBy(asc(traceSpans.sortOrder));

    return c.json({
      pr: {
        number: pr.number,
        title: pr.title,
        branch: pr.branch,
        baseBranch: pr.baseBranch,
        commits: pr.commits,
        filesChanged: pr.filesChanged,
        author: pr.author,
        githubUrl: pr.githubUrl,
        status: pr.status as 'pending' | 'approved' | 'merged',
        repo: { id: pr.repoId, owner: pr.owner, name: pr.repoName },
      },
      scan: {
        verdict: scan.verdict,
        verdictSub: scan.verdictSub,
        profiledAt: scan.profiledAt,
        stats: {
          p95: { value: scan.p95LatencyMs, baseline: scan.p95BaselineMs },
          cpu: { value: scan.cpuPct, baseline: scan.cpuBaselinePct },
          db: { queries: scan.dbQueries, nPlusOne: scan.dbNPlusOne },
          cache: { hitRate: scan.cacheHitRate, baseline: scan.cacheBaseline },
        },
        autofix: {
          fixable: scan.autofixCount,
          total: scan.autofixTotal,
          savingsMs: scan.autofixSavingsMs,
        },
      },
      issues,
      gates,
      flame: { rows: flame, axis },
      timeDistribution: timeDist,
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
  async (c) => {
    const num = Number(c.req.param('prNumber'));
    const pr = await getPR(num);
    if (!pr) return c.json({ error: 'pr not found' }, 404);
    const scan = await getLatestScan(pr.id);
    if (!scan) return c.json({ error: 'no scan' }, 404);
    const fixPrNumber = pr.number + 1;
    return c.json({
      ok: true,
      message: `Drift will open PR #${fixPrNumber} fixing ${scan.autofixCount} of ${scan.autofixTotal} issues`,
      estimatedSavingsMs: scan.autofixSavingsMs,
      fixPrNumber,
    });
  },
);

export default scans;
