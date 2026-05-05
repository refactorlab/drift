import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { ArchitectureSuggestionSchema, ArchPatchSchema } from '../schemas.ts';

const architecture = new Hono();

type ArchRow = {
  id: number; title: string; description: string;
  github_url: string | null; business_value: number; hours_saved: number;
  status: string; created_at: number;
  repo_id: number | null; repo_owner: string | null; repo_name: string | null;
  department_id: number | null; department_name: string | null;
};

function selectArchSql(where: string) {
  return `SELECT a.id, a.title, a.description, a.github_url, a.business_value,
                 a.hours_saved, a.status, a.created_at,
                 r.id AS repo_id, r.owner AS repo_owner, r.name AS repo_name,
                 d.id AS department_id, d.name AS department_name
          FROM architecture_suggestions a
          LEFT JOIN repos r ON r.id = a.repo_id
          LEFT JOIN departments d ON d.id = a.department_id
          ${where}
          ORDER BY a.business_value DESC, a.created_at DESC`;
}

function rowToArch(r: ArchRow) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    githubUrl: r.github_url,
    businessValue: r.business_value,
    hoursSaved: r.hours_saved,
    status: r.status,
    createdAt: r.created_at,
    repo: r.repo_id != null
      ? { id: r.repo_id, owner: r.repo_owner!, name: r.repo_name! }
      : null,
    department: r.department_id != null
      ? { id: r.department_id, name: r.department_name! }
      : null,
  };
}

architecture.get(
  '/',
  describeRoute({
    description: 'List large-scale architecture improvement proposals',
    tags: ['Architecture'],
    responses: {
      200: {
        description: 'Architecture suggestions list',
        content: { 'application/json': { schema: resolver(z.array(ArchitectureSuggestionSchema)) } },
      },
    },
  }),
  (c) => {
    const rows = db.prepare(selectArchSql('')).all() as ArchRow[];
    return c.json(rows.map(rowToArch));
  },
);

architecture.get(
  '/:id',
  describeRoute({
    description: 'Get a single architecture suggestion',
    tags: ['Architecture'],
    responses: {
      200: { description: 'Suggestion', content: { 'application/json': { schema: resolver(ArchitectureSuggestionSchema) } } },
      404: { description: 'Not found' },
    },
  }),
  (c) => {
    const id = Number(c.req.param('id'));
    const row = db.prepare(selectArchSql('WHERE a.id = ?')).get(id) as ArchRow | null;
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json(rowToArch(row));
  },
);

architecture.patch(
  '/:id',
  describeRoute({
    description: 'Edit an architecture suggestion',
    tags: ['Architecture'],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: resolver(ArchPatchSchema) } },
    },
    responses: {
      200: { description: 'Updated', content: { 'application/json': { schema: resolver(ArchitectureSuggestionSchema) } } },
      404: { description: 'Not found' },
    },
  }),
  validator('json', ArchPatchSchema),
  (c) => {
    const id = Number(c.req.param('id'));
    const body = c.req.valid('json');
    const sets: string[] = []; const params: unknown[] = [];
    if (body.title !== undefined) { sets.push('title = ?'); params.push(body.title); }
    if (body.description !== undefined) { sets.push('description = ?'); params.push(body.description); }
    if (body.githubUrl !== undefined) { sets.push('github_url = ?'); params.push(body.githubUrl); }
    if (body.businessValue !== undefined) { sets.push('business_value = ?'); params.push(body.businessValue); }
    if (body.hoursSaved !== undefined) { sets.push('hours_saved = ?'); params.push(body.hoursSaved); }
    if (body.status !== undefined) { sets.push('status = ?'); params.push(body.status); }
    if (!sets.length) return c.json({ error: 'no fields to update' }, 400);
    params.push(id);
    const result = db.prepare(`UPDATE architecture_suggestions SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    if (result.changes === 0) return c.json({ error: 'not found' }, 404);
    const row = db.prepare(selectArchSql('WHERE a.id = ?')).get(id) as ArchRow;
    return c.json(rowToArch(row));
  },
);

export default architecture;
