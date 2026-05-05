import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@drift.local';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '1234';

/**
 * Idempotent admin upsert. Always runs after migrations so the demo admin
 * exists even on databases that pre-date the auth feature.
 */
export async function seedAdmin() {
  const passwordHash = await Bun.password.hash(ADMIN_PASSWORD, {
    algorithm: 'argon2id',
  });

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, role: 'admin' })
      .where(eq(users.id, existing.id));
    return { created: false, id: existing.id };
  }

  const [created] = await db
    .insert(users)
    .values({
      email: ADMIN_EMAIL,
      name: 'Admin',
      role: 'admin',
      githubUsername: 'admin',
      initials: 'AD',
      departmentId: null,
      passwordHash,
    })
    .returning({ id: users.id });

  return { created: true, id: created.id };
}
