import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { PRSummarySchema, PRPatchSchema, PRStatus } from '../schemas.ts';

const prs = new Hono();

const listQuerySchema = z.object({
  status: PRStatus.optional(),
  repoId: z.coerce.number().optional(),
  departmentId: z.coerce.number().optional(),
});

type PRListRow = {
  id: number; number: number; title: string; status: 'pending' | 'approved' | 'merged';
  author: string; githubUrl: string; improvement: string | null;
  businessValue: number; hoursSaved: number;
  branch: string; baseBranch: string; commits: number; filesChanged: number;
  repoId: number; repoOwner: string; repoName: string;
  deptId: number | null; deptName: string | null;
  scanVerdict: string | null; scanP95: number | null; scanProfiledAt: number | null;
};

function selectPRsSql(where: string) {
  return `SELECT pr.id, pr.number, pr.title, pr.status,
                pr.author, pr.github_url AS githubUrl, pr.improvement,
                pr.business_value AS businessValue, pr.hours_saved AS hoursSaved,
                pr.branch, pr.base_branch AS baseBranch, pr.commits, pr.files_changed AS filesChanged,
                r.id AS repoId, r.owner AS repoOwner, r.name AS repoName,
                d.id AS deptId, d.name AS deptName,
                s.verdict AS scanVerdict, s.p95_latency_ms AS scanP95, s.profiled_at AS scanProfiledAt
         FROM pull_requests pr
         JOIN repos r ON r.id = pr.repo_id
         LEFT JOIN departments d ON d.id = r.department_id
         LEFT JOIN scans s ON s.id = (
           SELECT id FROM scans WHERE pr_id = pr.id ORDER BY id DESC LIMIT 1
         )
         ${where}
         ORDER BY pr.number DESC`;
}

function rowToPR(r: PRListRow) {
  return {
    id: r.id, number: r.number, title: r.title, status: r.status,
    author: r.author, githubUrl: r.githubUrl, improvement: r.improvement,
    businessValue: r.businessValue, hoursSaved: r.hoursSaved,
    branch: r.branch, baseBranch: r.baseBranch,
    commits: r.commits, filesChanged: r.filesChanged,
    repo: { id: r.repoId, owner: r.repoOwner, name: r.repoName },
    department: r.deptId != null ? { id: r.deptId, name: r.deptName! } : null,
    scan: r.scanVerdict
      ? { verdict: r.scanVerdict, p95LatencyMs: r.scanP95!, profiledAt: r.scanProfiledAt! }
      : null,
  };
}

prs.get(
  '/',
  describeRoute({
    description: 'List pull requests with optional status / repo / department filters',
    tags: ['PRs'],
    responses: {
      200: {
        description: 'PR list',
        content: { 'application/json': { schema: resolver(z.array(PRSummarySchema)) } },
      },
    },
  }),
  validator('query', listQuerySchema),
  (c) => {
    const q = c.req.valid('query');
    const conds: string[] = [];
    const params: unknown[] = [];
    if (q.status) { conds.push('pr.status = ?'); params.push(q.status); }
    if (q.repoId) { conds.push('pr.repo_id = ?'); params.push(q.repoId); }
    if (q.departmentId) { conds.push('r.department_id = ?'); params.push(q.departmentId); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = db.prepare(selectPRsSql(where)).all(...params) as PRListRow[];
    return c.json(rows.map(rowToPR));
  },
);

prs.get(
  '/:id',
  describeRoute({
    description: 'Get a single PR by id',
    tags: ['PRs'],
    responses: {
      200: { description: 'PR', content: { 'application/json': { schema: resolver(PRSummarySchema) } } },
      404: { description: 'PR not found' },
    },
  }),
  (c) => {
    const id = Number(c.req.param('id'));
    const row = db.prepare(selectPRsSql('WHERE pr.id = ?')).get(id) as PRListRow | null;
    if (!row) return c.json({ error: 'pr not found' }, 404);
    return c.json(rowToPR(row));
  },
);

prs.patch(
  '/:id',
  describeRoute({
    description: 'Edit business_value, hours_saved, improvement, or status of a PR',
    tags: ['PRs'],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: resolver(PRPatchSchema) } },
    },
    responses: {
      200: { description: 'Updated PR', content: { 'application/json': { schema: resolver(PRSummarySchema) } } },
      404: { description: 'PR not found' },
    },
  }),
  validator('json', PRPatchSchema),
  (c) => {
    const id = Number(c.req.param('id'));
    const body = c.req.valid('json');
    const sets: string[] = []; const params: unknown[] = [];
    if (body.improvement !== undefined) { sets.push('improvement = ?'); params.push(body.improvement); }
    if (body.businessValue !== undefined) { sets.push('business_value = ?'); params.push(body.businessValue); }
    if (body.hoursSaved !== undefined) { sets.push('hours_saved = ?'); params.push(body.hoursSaved); }
    if (body.status !== undefined) { sets.push('status = ?'); params.push(body.status); }
    if (!sets.length) return c.json({ error: 'no fields to update' }, 400);
    params.push(id);
    const result = db.prepare(`UPDATE pull_requests SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    if (result.changes === 0) return c.json({ error: 'pr not found' }, 404);
    const row = db.prepare(selectPRsSql('WHERE pr.id = ?')).get(id) as PRListRow;
    return c.json(rowToPR(row));
  },
);

export default prs;
