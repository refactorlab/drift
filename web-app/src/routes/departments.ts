import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import { desc, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { departments as departmentsTable } from '../db/schema.ts';
import { DepartmentSchema } from '../schemas.ts';

const departments = new Hono();

departments.get(
  '/',
  describeRoute({
    description: 'List departments with rolled-up PR / business-value totals',
    tags: ['Departments'],
    responses: {
      200: {
        description: 'Department list',
        content: { 'application/json': { schema: resolver(z.array(DepartmentSchema)) } },
      },
    },
  }),
  async (c) => {
    const totalBV = sql<number>`(SELECT COALESCE(SUM(pr.business_value), 0)::int
                                   FROM pull_requests pr
                                   JOIN repos r ON r.id = pr.repo_id
                                   WHERE r.department_id = departments.id)`;

    const rows = await db
      .select({
        id: departmentsTable.id,
        name: departmentsTable.name,
        repoCount: sql<number>`(SELECT COUNT(*)::int FROM repos WHERE department_id = departments.id)`,
        prCount: sql<number>`(SELECT COUNT(*)::int FROM pull_requests pr
                                JOIN repos r ON r.id = pr.repo_id
                                WHERE r.department_id = departments.id)`,
        totalBV,
        totalHS: sql<number>`(SELECT COALESCE(SUM(pr.hours_saved), 0)::int
                                FROM pull_requests pr
                                JOIN repos r ON r.id = pr.repo_id
                                WHERE r.department_id = departments.id)`,
      })
      .from(departmentsTable)
      .orderBy(desc(totalBV));

    return c.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        repoCount: r.repoCount,
        prCount: r.prCount,
        totalBusinessValue: r.totalBV,
        totalHoursSaved: r.totalHS,
      })),
    );
  },
);

export default departments;
