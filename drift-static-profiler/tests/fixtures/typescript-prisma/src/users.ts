import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function showUsers() {
  // Negative: simple findMany — no findings expected.
  return prisma.user.findMany();
}

export async function deepInclude() {
  // PRI-INC-001: deep nested include — Cartesian risk.
  return prisma.user.findMany({
    include: {
      posts: {
        include: {
          comments: {
            include: { author: true },
          },
        },
      },
    },
  });
}

export async function nPlusOneByIds(ids: number[]) {
  // PRI-N1-002: findUnique inside loop — N+1.
  const out = [];
  for (const id of ids) {
    const u = await prisma.user.findUnique({ where: { id } });
    out.push(u);
  }
  return out;
}

export async function rawUnsafe(name: string) {
  // PRI-RAW-003: $queryRawUnsafe with template interpolation.
  return prisma.$queryRawUnsafe(`SELECT * FROM users WHERE name = '${name}'`);
}

export async function deepPagination() {
  // PRI-PAG-004: skip ≥ 1000 — keyset pagination required.
  return prisma.post.findMany({ skip: 5000, take: 50 });
}
