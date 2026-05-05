import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { pullRequests, repos, scans } from '../db/schema.ts';
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
  async (c) => {
    const [scanCounts] = await db.execute<{
      total: number; failed: number; passed: number; warn: number;
    }>(sql`
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(CASE WHEN verdict = 'FAILED' THEN 1 ELSE 0 END), 0)::int AS failed,
        COALESCE(SUM(CASE WHEN verdict = 'PASSED' THEN 1 ELSE 0 END), 0)::int AS passed,
        COALESCE(SUM(CASE WHEN verdict = 'WARN' THEN 1 ELSE 0 END), 0)::int AS warn
      FROM (
        SELECT s.* FROM ${scans} s
        WHERE s.id = (SELECT id FROM ${scans} WHERE pr_id = s.pr_id ORDER BY id DESC LIMIT 1)
      ) latest
    `);

    const [improvements] = await db.execute<{
      pending: number; approved: number;
      pendingBV: number; approvedBV: number; totalHS: number;
    }>(sql`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0)::int AS pending,
        COALESCE(SUM(CASE WHEN status IN ('approved', 'merged') THEN 1 ELSE 0 END), 0)::int AS approved,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN business_value ELSE 0 END), 0)::int AS "pendingBV",
        COALESCE(SUM(CASE WHEN status IN ('approved', 'merged') THEN business_value ELSE 0 END), 0)::int AS "approvedBV",
        COALESCE(SUM(hours_saved), 0)::int AS "totalHS"
      FROM ${pullRequests}
    `);

    const topRepos = await db
      .select({
        id: repos.id,
        owner: repos.owner,
        name: repos.name,
        prCount: sql<number>`COUNT(${pullRequests.id})::int`,
        totalBV: sql<number>`COALESCE(SUM(${pullRequests.businessValue}), 0)::int`,
      })
      .from(repos)
      .leftJoin(pullRequests, eq(pullRequests.repoId, repos.id))
      .groupBy(repos.id)
      .orderBy(desc(sql`COALESCE(SUM(${pullRequests.businessValue}), 0)`))
      .limit(5);

    const latestScan = db
      .select({
        id: sql<number>`MAX(${scans.id})`.as('latest_id'),
        prId: scans.prId,
      })
      .from(scans)
      .groupBy(scans.prId)
      .as('latest_scan');

    const recentScansRaw = await db
      .select({
        prNumber: pullRequests.number,
        prTitle: pullRequests.title,
        prStatus: pullRequests.status,
        author: pullRequests.author,
        repoId: repos.id,
        repoOwner: repos.owner,
        repoName: repos.name,
        verdict: scans.verdict,
        verdictSub: scans.verdictSub,
        profiledAt: scans.profiledAt,
        p95LatencyMs: scans.p95LatencyMs,
        p95BaselineMs: scans.p95BaselineMs,
        cpuPct: scans.cpuPct,
        cacheHitRate: scans.cacheHitRate,
      })
      .from(pullRequests)
      .innerJoin(repos, eq(repos.id, pullRequests.repoId))
      .innerJoin(latestScan, eq(latestScan.prId, pullRequests.id))
      .innerJoin(scans, eq(scans.id, latestScan.id))
      .orderBy(desc(scans.profiledAt))
      .limit(6);

    return c.json({
      scans: {
        total: scanCounts?.total ?? 0,
        failed: scanCounts?.failed ?? 0,
        passed: scanCounts?.passed ?? 0,
        warn: scanCounts?.warn ?? 0,
      },
      improvements: {
        pending: improvements?.pending ?? 0,
        approved: improvements?.approved ?? 0,
        pendingBusinessValue: improvements?.pendingBV ?? 0,
        approvedBusinessValue: improvements?.approvedBV ?? 0,
        totalHoursSaved: improvements?.totalHS ?? 0,
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
    });
  },
);

export default dashboard;
