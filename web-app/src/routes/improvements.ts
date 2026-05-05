import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '../db/index.ts';
import { ImprovementsResponseSchema } from '../schemas.ts';

const improvements = new Hono();

type ImprovementRow = {
  id: number; number: number; title: string; status: string;
  author: string; githubUrl: string; improvement: string | null;
  businessValue: number; hoursSaved: number;
  branch: string; baseBranch: string; commits: number; filesChanged: number;
  repoId: number; repoOwner: string; repoName: string;
  deptId: number | null; deptName: string | null;
  scanVerdict: string | null; scanP95: number | null; scanProfiledAt: number | null;
  repoTotal: number; deptTotal: number; companyTotal: number;
};

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
  (c) => {
    const sql = `
      SELECT pr.id, pr.number, pr.title, pr.status,
             pr.author, pr.github_url AS githubUrl, pr.improvement,
             pr.business_value AS businessValue, pr.hours_saved AS hoursSaved,
             pr.branch, pr.base_branch AS baseBranch,
             pr.commits, pr.files_changed AS filesChanged,
             r.id AS repoId, r.owner AS repoOwner, r.name AS repoName,
             d.id AS deptId, d.name AS deptName,
             s.verdict AS scanVerdict, s.p95_latency_ms AS scanP95, s.profiled_at AS scanProfiledAt,
             (SELECT COALESCE(SUM(business_value), 0) FROM pull_requests WHERE repo_id = r.id) AS repoTotal,
             (SELECT COALESCE(SUM(p2.business_value), 0)
                FROM pull_requests p2
                JOIN repos r2 ON r2.id = p2.repo_id
                WHERE r2.department_id = r.department_id) AS deptTotal,
             (SELECT COALESCE(SUM(business_value), 0) FROM pull_requests) AS companyTotal
      FROM pull_requests pr
      JOIN repos r ON r.id = pr.repo_id
      LEFT JOIN departments d ON d.id = r.department_id
      LEFT JOIN scans s ON s.id = (
        SELECT id FROM scans WHERE pr_id = pr.id ORDER BY id DESC LIMIT 1
      )
      ORDER BY pr.business_value DESC, pr.number DESC
    `;
    const rows = db.prepare(sql).all() as ImprovementRow[];

    const map = (r: ImprovementRow) => ({
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
        ? { verdict: r.scanVerdict, p95LatencyMs: r.scanP95!, profiledAt: r.scanProfiledAt! }
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
