import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '../db/index.ts';
import { DashboardSchema } from '../schemas.ts';

const dashboard = new Hono();

dashboard.get(
  '/',
  describeRoute({
    description: 'Aggregated overview: scan counts, improvement totals, top repos, recent scans',
    tags: ['Dashboard'],
    responses: {
      200: {
        description: 'Dashboard data',
        content: { 'application/json': { schema: resolver(DashboardSchema) } },
      },
    },
  }),
  (c) => {
    const scanCounts = db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN verdict = 'FAILED' THEN 1 ELSE 0 END) AS failed,
           SUM(CASE WHEN verdict = 'PASSED' THEN 1 ELSE 0 END) AS passed,
           SUM(CASE WHEN verdict = 'WARN' THEN 1 ELSE 0 END) AS warn
         FROM (
           SELECT s.* FROM scans s
           WHERE s.id = (SELECT id FROM scans WHERE pr_id = s.pr_id ORDER BY id DESC LIMIT 1)
         )`,
      )
      .get() as { total: number; failed: number; passed: number; warn: number };

    const improvements = db
      .prepare(
        `SELECT
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status IN ('approved', 'merged') THEN 1 ELSE 0 END) AS approved,
           SUM(CASE WHEN status = 'pending' THEN business_value ELSE 0 END) AS pendingBV,
           SUM(CASE WHEN status IN ('approved', 'merged') THEN business_value ELSE 0 END) AS approvedBV,
           SUM(hours_saved) AS totalHS
         FROM pull_requests`,
      )
      .get() as {
        pending: number; approved: number;
        pendingBV: number; approvedBV: number; totalHS: number;
      };

    const topRepos = db
      .prepare(
        `SELECT r.id, r.owner, r.name,
                COUNT(pr.id) AS prCount,
                COALESCE(SUM(pr.business_value), 0) AS totalBV
         FROM repos r
         LEFT JOIN pull_requests pr ON pr.repo_id = r.id
         GROUP BY r.id
         ORDER BY totalBV DESC
         LIMIT 5`,
      )
      .all() as Array<{ id: number; owner: string; name: string; prCount: number; totalBV: number }>;

    const recentScansRaw = db
      .prepare(
        `SELECT pr.number AS prNumber, pr.title AS prTitle, pr.status AS prStatus, pr.author,
                r.id AS repoId, r.owner, r.name AS repoName,
                s.verdict, s.verdict_sub AS verdictSub, s.profiled_at AS profiledAt,
                s.p95_latency_ms AS p95LatencyMs, s.p95_baseline_ms AS p95BaselineMs,
                s.cpu_pct AS cpuPct, s.cache_hit_rate AS cacheHitRate
         FROM pull_requests pr
         JOIN repos r ON r.id = pr.repo_id
         JOIN scans s ON s.id = (SELECT id FROM scans WHERE pr_id = pr.id ORDER BY id DESC LIMIT 1)
         ORDER BY s.profiled_at DESC
         LIMIT 6`,
      )
      .all() as Array<{
        prNumber: number; prTitle: string; prStatus: string; author: string;
        repoId: number; owner: string; repoName: string;
        verdict: string; verdictSub: string; profiledAt: number;
        p95LatencyMs: number; p95BaselineMs: number; cpuPct: number; cacheHitRate: number;
      }>;

    return c.json({
      scans: {
        total: scanCounts.total ?? 0,
        failed: scanCounts.failed ?? 0,
        passed: scanCounts.passed ?? 0,
        warn: scanCounts.warn ?? 0,
      },
      improvements: {
        pending: improvements.pending ?? 0,
        approved: improvements.approved ?? 0,
        pendingBusinessValue: improvements.pendingBV ?? 0,
        approvedBusinessValue: improvements.approvedBV ?? 0,
        totalHoursSaved: improvements.totalHS ?? 0,
      },
      topRepos: topRepos.map((r) => ({
        id: r.id,
        owner: r.owner,
        name: r.name,
        prCount: r.prCount,
        totalBusinessValue: r.totalBV,
      })),
      recentScans: recentScansRaw.map((r) => ({
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
    });
  },
);

export default dashboard;
