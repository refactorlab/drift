import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { pullRequests, repos, departments, scans } from '../db/schema.ts';
import { ImprovementsResponseSchema } from '../schemas.ts';

const improvements = new Hono();

improvements.get(
  '/',
  describeRoute({
    description:
      'PR Improvements Dashboard data: PRs grouped by status (pending / approved) with rollup totals at repo, department, and company level.',
    tags: ['Improvements'],
    responses: {
      200: {
        description: 'Improvements grouped by status with rollups',
        content: {
          'application/json': { schema: resolver(ImprovementsResponseSchema) },
        },
      },
    },
  }),
  async (c) => {
    const latestScan = db
      .select({
        id: sql<number>`MAX(${scans.id})`.as('latest_id'),
        prId: scans.prId,
      })
      .from(scans)
      .groupBy(scans.prId)
      .as('latest_scan');

    const rows = await db
      .select({
        id: pullRequests.id,
        number: pullRequests.number,
        title: pullRequests.title,
        status: pullRequests.status,
        author: pullRequests.author,
        githubUrl: pullRequests.githubUrl,
        improvement: pullRequests.improvement,
        businessValue: pullRequests.businessValue,
        hoursSaved: pullRequests.hoursSaved,
        branch: pullRequests.branch,
        baseBranch: pullRequests.baseBranch,
        commits: pullRequests.commits,
        filesChanged: pullRequests.filesChanged,
        repoId: repos.id,
        repoOwner: repos.owner,
        repoName: repos.name,
        deptId: departments.id,
        deptName: departments.name,
        scanVerdict: scans.verdict,
        scanP95: scans.p95LatencyMs,
        scanProfiledAt: scans.profiledAt,
        repoTotal: sql<number>`(SELECT COALESCE(SUM(business_value), 0)::int FROM pull_requests WHERE repo_id = repos.id)`,
        deptTotal: sql<number>`(SELECT COALESCE(SUM(p2.business_value), 0)::int
                                  FROM pull_requests p2
                                  JOIN repos r2 ON r2.id = p2.repo_id
                                  WHERE r2.department_id = repos.department_id)`,
        companyTotal: sql<number>`(SELECT COALESCE(SUM(business_value), 0)::int FROM pull_requests)`,
      })
      .from(pullRequests)
      .innerJoin(repos, eq(repos.id, pullRequests.repoId))
      .leftJoin(departments, eq(departments.id, repos.departmentId))
      .leftJoin(latestScan, eq(latestScan.prId, pullRequests.id))
      .leftJoin(scans, eq(scans.id, latestScan.id))
      .orderBy(desc(pullRequests.businessValue), desc(pullRequests.number));

    const map = (r: (typeof rows)[number]) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      status: r.status as 'pending' | 'approved' | 'merged',
      author: r.author,
      githubUrl: r.githubUrl,
      improvement: r.improvement,
      businessValue: r.businessValue,
      hoursSaved: r.hoursSaved,
      branch: r.branch,
      baseBranch: r.baseBranch,
      commits: r.commits,
      filesChanged: r.filesChanged,
      repo: { id: r.repoId, owner: r.repoOwner, name: r.repoName },
      department: r.deptId != null ? { id: r.deptId, name: r.deptName! } : null,
      scan: r.scanVerdict
        ? {
            verdict: r.scanVerdict,
            p95LatencyMs: r.scanP95!,
            profiledAt: r.scanProfiledAt!,
          }
        : null,
      rollups: {
        repoTotal: r.repoTotal,
        departmentTotal: r.deptTotal,
        companyTotal: r.companyTotal,
      },
    });

    const pending = rows.filter((r) => r.status === 'pending').map(map);
    const approved = rows
      .filter((r) => r.status === 'approved' || r.status === 'merged')
      .map(map);
    const sumBV = (arr: typeof pending) => arr.reduce((s, x) => s + x.businessValue, 0);
    const sumHS = (arr: typeof pending) => arr.reduce((s, x) => s + x.hoursSaved, 0);

    return c.json({
      pending,
      approved,
      totals: {
        pendingCount: pending.length,
        approvedCount: approved.length,
        pendingBusinessValue: sumBV(pending),
        approvedBusinessValue: sumBV(approved),
        pendingHoursSaved: sumHS(pending),
        approvedHoursSaved: sumHS(approved),
        companyBusinessValue: rows.reduce((s, r) => s + r.businessValue, 0),
        companyHoursSaved: rows.reduce((s, r) => s + r.hoursSaved, 0),
      },
    });
  },
);

export default improvements;
