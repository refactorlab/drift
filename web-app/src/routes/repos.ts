import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { RepoSchema } from '../schemas.ts';

const repos = new Hono();

type RepoRow = {
  id: number; owner: string; name: string;
  department_id: number | null; department_name: string | null;
  prCount: number; totalBV: number; totalHS: number;
};

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
  (c) => {
    const rows = db
      .prepare(
        `SELECT r.id, r.owner, r.name,
                d.id AS department_id, d.name AS department_name,
                (SELECT COUNT(*) FROM pull_requests WHERE repo_id = r.id) AS prCount,
                (SELECT COALESCE(SUM(business_value), 0) FROM pull_requests WHERE repo_id = r.id) AS totalBV,
                (SELECT COALESCE(SUM(hours_saved), 0) FROM pull_requests WHERE repo_id = r.id) AS totalHS
         FROM repos r
         LEFT JOIN departments d ON d.id = r.department_id
         ORDER BY totalBV DESC, r.name ASC`,
      )
      .all() as RepoRow[];
    return c.json(
      rows.map((r) => ({
        id: r.id,
        owner: r.owner,
        name: r.name,
        department:
          r.department_id != null ? { id: r.department_id, name: r.department_name! } : null,
        prCount: r.prCount,
        totalBusinessValue: r.totalBV,
        totalHoursSaved: r.totalHS,
      })),
    );
  },
);

export default repos;
