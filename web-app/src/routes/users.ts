import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { UserSchema } from '../schemas.ts';

const users = new Hono();

type UserRow = {
  id: number; email: string; name: string; role: string;
  github_username: string; initials: string;
  department_id: number | null; department_name: string | null;
};

users.get(
  '/',
  describeRoute({
    description: 'List all users',
    tags: ['Users'],
    responses: {
      200: {
        description: 'User list',
        content: { 'application/json': { schema: resolver(z.array(UserSchema)) } },
      },
    },
  }),
  (c) => {
    const rows = db
      .prepare(
        `SELECT u.id, u.email, u.name, u.role, u.github_username, u.initials,
                d.id AS department_id, d.name AS department_name
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         ORDER BY u.name ASC`,
      )
      .all() as UserRow[];
    return c.json(
      rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        role: r.role,
        githubUsername: r.github_username,
        initials: r.initials,
        department:
          r.department_id != null ? { id: r.department_id, name: r.department_name! } : null,
      })),
    );
  },
);

export default users;
