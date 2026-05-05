import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { repos as reposTable, departments, pullRequests } from '../db/schema.ts';
import { RepoSchema } from '../schemas.ts';

const repos = new Hono();

repos.get(
  '/',
  describeRoute({
    description: 'List repositories with department, PR counts, and rolled-up totals',
    tags: ['Repos'],
    responses: {
      200: {
        description: 'Repository list',
        content: { 'application/json': { schema: resolver(z.array(RepoSchema)) } },
      },
    },
  }),
  async (c) => {
    const rows = await db
      .select({
        id: reposTable.id,
        owner: reposTable.owner,
        name: reposTable.name,
        deptId: departments.id,
        deptName: departments.name,
        prCount: sql<number>`COUNT(${pullRequests.id})::int`,
        totalBV: sql<number>`COALESCE(SUM(${pullRequests.businessValue}), 0)::int`,
        totalHS: sql<number>`COALESCE(SUM(${pullRequests.hoursSaved}), 0)::int`,
      })
      .from(reposTable)
      .leftJoin(departments, eq(departments.id, reposTable.departmentId))
      .leftJoin(pullRequests, eq(pullRequests.repoId, reposTable.id))
      .groupBy(reposTable.id, departments.id, departments.name)
      .orderBy(desc(sql`COALESCE(SUM(${pullRequests.businessValue}), 0)`), asc(reposTable.name));

    return c.json(
      rows.map((r) => ({
        id: r.id,
        owner: r.owner,
        name: r.name,
        department: r.deptId != null ? { id: r.deptId, name: r.deptName! } : null,
        prCount: r.prCount,
        totalBusinessValue: r.totalBV,
        totalHoursSaved: r.totalHS,
      })),
    );
  },
);

export default repos;
