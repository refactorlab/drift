import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import { users, posts } from "./schema";

const db = drizzle({} as any);

export async function listTop10() {
  // DRZ-LMT-001: .limit() with no .orderBy() — non-deterministic rows.
  return db.select().from(users).limit(10);
}

export async function listTop10Sorted() {
  // Negative: ordered + limited — clean.
  return db.select().from(users).orderBy(users.id).limit(10);
}

export async function lookupByIds(ids: number[]) {
  // DRZ-N1-002: select+where inside for-of loop — N+1.
  const out = [];
  for (const id of ids) {
    const row = await db.select().from(users).where(eq(users.id, id));
    out.push(row);
  }
  return out;
}

export async function lookupByIdsBulk(ids: number[]) {
  // Negative: single bulk query using inArray.
  return db.select().from(users).where(inArray(users.id, ids));
}
