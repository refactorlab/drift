import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import { desc, eq, type SQL } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { architectureSuggestions, repos, departments } from '../db/schema.ts';
import { ArchitectureSuggestionSchema, ArchPatchSchema } from '../schemas.ts';

const architecture = new Hono();

type ArchRow = Awaited<ReturnType<typeof selectArch>>[number];

function selectArch(where?: SQL) {
  const q = db
    .select({
      id: architectureSuggestions.id,
      title: architectureSuggestions.title,
      description: architectureSuggestions.description,
      githubUrl: architectureSuggestions.githubUrl,
      businessValue: architectureSuggestions.businessValue,
      hoursSaved: architectureSuggestions.hoursSaved,
      status: architectureSuggestions.status,
      createdAt: architectureSuggestions.createdAt,
      repoId: repos.id,
      repoOwner: repos.owner,
      repoName: repos.name,
      deptId: departments.id,
      deptName: departments.name,
    })
    .from(architectureSuggestions)
    .leftJoin(repos, eq(repos.id, architectureSuggestions.repoId))
    .leftJoin(departments, eq(departments.id, architectureSuggestions.departmentId))
    .orderBy(desc(architectureSuggestions.businessValue), desc(architectureSuggestions.createdAt));

  return where ? q.where(where) : q;
}

function rowToArch(r: ArchRow) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    githubUrl: r.githubUrl,
    businessValue: r.businessValue,
    hoursSaved: r.hoursSaved,
    status: r.status,
    createdAt: r.createdAt,
    repo:
      r.repoId != null
        ? { id: r.repoId, owner: r.repoOwner!, name: r.repoName! }
        : null,
    department:
      r.deptId != null ? { id: r.deptId, name: r.deptName! } : null,
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
  async (c) => {
    const rows = await selectArch();
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
  async (c) => {
    const id = Number(c.req.param('id'));
    const [row] = await selectArch(eq(architectureSuggestions.id, id));
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
  async (c) => {
    const id = Number(c.req.param('id'));
    const body = c.req.valid('json');
    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.description !== undefined) patch.description = body.description;
    if (body.githubUrl !== undefined) patch.githubUrl = body.githubUrl;
    if (body.businessValue !== undefined) patch.businessValue = body.businessValue;
    if (body.hoursSaved !== undefined) patch.hoursSaved = body.hoursSaved;
    if (body.status !== undefined) patch.status = body.status;
    if (Object.keys(patch).length === 0) {
      return c.json({ error: 'no fields to update' }, 400);
    }
    const updated = await db
      .update(architectureSuggestions)
      .set(patch)
      .where(eq(architectureSuggestions.id, id))
      .returning({ id: architectureSuggestions.id });
    if (updated.length === 0) return c.json({ error: 'not found' }, 404);
    const [row] = await selectArch(eq(architectureSuggestions.id, id));
    return c.json(rowToArch(row!));
  },
);

export default architecture;
