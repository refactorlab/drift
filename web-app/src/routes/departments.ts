import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { DepartmentSchema } from '../schemas.ts';

const departments = new Hono();

type DeptRow = {
  id: number; name: string;
  repoCount: number; prCount: number; totalBV: number; totalHS: number;
};

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
  (c) => {
    const rows = db
      .prepare(
        `SELECT d.id, d.name,
                (SELECT COUNT(*) FROM repos WHERE department_id = d.id) AS repoCount,
                (SELECT COUNT(*) FROM pull_requests pr
                   JOIN repos r ON r.id = pr.repo_id
                   WHERE r.department_id = d.id) AS prCount,
                (SELECT COALESCE(SUM(pr.business_value), 0) FROM pull_requests pr
                   JOIN repos r ON r.id = pr.repo_id
                   WHERE r.department_id = d.id) AS totalBV,
                (SELECT COALESCE(SUM(pr.hours_saved), 0) FROM pull_requests pr
                   JOIN repos r ON r.id = pr.repo_id
                   WHERE r.department_id = d.id) AS totalHS
         FROM departments d
         ORDER BY totalBV DESC`,
      )
      .all() as DeptRow[];
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
