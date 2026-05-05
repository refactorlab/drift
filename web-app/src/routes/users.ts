import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { users as usersTable, departments } from '../db/schema.ts';
import { UserSchema } from '../schemas.ts';

const users = new Hono();

users.get(
  '/',
  describeRoute({
    description: 'List all users',
    tags: ['Users'],
    responses: {
      200: {
        description: 'User list',
        content: {
          'application/json': { schema: resolver(z.array(UserSchema)) },
        },
      },
    },
  }),
  async (c) => {
    const rows = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        githubUsername: usersTable.githubUsername,
        initials: usersTable.initials,
        deptId: departments.id,
        deptName: departments.name,
      })
      .from(usersTable)
      .leftJoin(departments, eq(departments.id, usersTable.departmentId))
      .orderBy(asc(usersTable.name));

    return c.json(
      rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        role: r.role,
        githubUsername: r.githubUsername,
        initials: r.initials,
        department: r.deptId != null ? { id: r.deptId, name: r.deptName! } : null,
      })),
    );
  },
);

export default users;
