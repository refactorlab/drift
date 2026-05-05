import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { pullRequests, repos, departments, scans } from '../db/schema.ts';
import { PRSummarySchema, PRPatchSchema, PRStatus } from '../schemas.ts';

const prs = new Hono();

const listQuerySchema = z.object({
  status: PRStatus.optional(),
  repoId: z.coerce.number().optional(),
  departmentId: z.coerce.number().optional(),
});

type PRListRow = Awaited<ReturnType<typeof selectPRs>>[number];

function selectPRs(where?: SQL) {
  const latestScan = db
    .select({
      id: sql<number>`MAX(${scans.id})`.as('latest_id'),
      prId: scans.prId,
    })
    .from(scans)
    .groupBy(scans.prId)
    .as('latest_scan');

  const q = db
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
    })
    .from(pullRequests)
    .innerJoin(repos, eq(repos.id, pullRequests.repoId))
    .leftJoin(departments, eq(departments.id, repos.departmentId))
    .leftJoin(latestScan, eq(latestScan.prId, pullRequests.id))
    .leftJoin(scans, eq(scans.id, latestScan.id))
    .orderBy(desc(pullRequests.number));

  return where ? q.where(where) : q;
}

function rowToPR(r: PRListRow) {
  return {
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
  async (c) => {
    const q = c.req.valid('query');
    const conds: SQL[] = [];
    if (q.status) conds.push(eq(pullRequests.status, q.status));
    if (q.repoId) conds.push(eq(pullRequests.repoId, q.repoId));
    if (q.departmentId) conds.push(eq(repos.departmentId, q.departmentId));
    const where = conds.length ? and(...conds) : undefined;
    const rows = await selectPRs(where);
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
  async (c) => {
    const id = Number(c.req.param('id'));
    const [row] = await selectPRs(eq(pullRequests.id, id));
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
  async (c) => {
    const id = Number(c.req.param('id'));
    const body = c.req.valid('json');
    const patch: Record<string, unknown> = {};
    if (body.improvement !== undefined) patch.improvement = body.improvement;
    if (body.businessValue !== undefined) patch.businessValue = body.businessValue;
    if (body.hoursSaved !== undefined) patch.hoursSaved = body.hoursSaved;
    if (body.status !== undefined) patch.status = body.status;
    if (Object.keys(patch).length === 0) {
      return c.json({ error: 'no fields to update' }, 400);
    }
    const updated = await db
      .update(pullRequests)
      .set(patch)
      .where(eq(pullRequests.id, id))
      .returning({ id: pullRequests.id });
    if (updated.length === 0) return c.json({ error: 'pr not found' }, 404);
    const [row] = await selectPRs(eq(pullRequests.id, id));
    return c.json(rowToPR(row!));
  },
);

export default prs;
