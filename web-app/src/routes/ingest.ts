import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  repos,
  pullRequests,
  scans as scansTable,
  issues as issuesTable,
} from '../db/schema.ts';
import {
  ScanIngestSchema,
  authorizeBearer,
  computeVerdict,
} from '../ingest/schema.ts';

const ingest = new Hono();

ingest.post('/scans', async (c) => {
  if (!authorizeBearer(c.req.header('authorization'), process.env.DRIFT_INGEST_TOKEN)) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const json = await c.req.json().catch(() => null);
  const parsed = ScanIngestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  const { repo, pr, report } = parsed.data;

  const [repoRow] = await db
    .insert(repos)
    .values({ owner: repo.owner, name: repo.name })
    .onConflictDoUpdate({
      target: [repos.owner, repos.name],
      set: { owner: repo.owner },
    })
    .returning();

  const [prRow] = await db
    .insert(pullRequests)
    .values({
      repoId: repoRow.id,
      number: pr.number,
      title: pr.title,
      branch: pr.branch,
      baseBranch: pr.baseBranch,
      commits: 1,
      filesChanged: 0,
      author: pr.author,
      status: 'pending',
      githubUrl: pr.url,
    })
    .onConflictDoUpdate({
      target: [pullRequests.repoId, pullRequests.number],
      set: { title: pr.title, branch: pr.branch, baseBranch: pr.baseBranch },
    })
    .returning();

  // Look up the previous scan on this PR to compute baseline + verdict.
  const [prev] = await db
    .select()
    .from(scansTable)
    .where(eq(scansTable.prId, prRow.id))
    .orderBy(desc(scansTable.id))
    .limit(1);

  const p95Baseline = prev?.p95LatencyMs ?? report.p95LatencyMs;
  const { verdict, verdictSub } = computeVerdict(report.p95LatencyMs, p95Baseline);

  const [scanRow] = await db
    .insert(scansTable)
    .values({
      prId: prRow.id,
      verdict,
      verdictSub,
      profiledAt: Date.now(),
      p95LatencyMs: report.p95LatencyMs,
      p95BaselineMs: p95Baseline,
      cpuPct: report.cpuPct,
      cpuBaselinePct: prev?.cpuPct ?? report.cpuPct,
      dbQueries: report.dbQueries,
      dbNPlusOne: report.dbNPlusOne,
      cacheHitRate: report.cacheHitRate,
      cacheBaseline: prev?.cacheHitRate ?? report.cacheHitRate,
      autofixCount: 0,
      autofixTotal: report.issues.length,
      autofixSavingsMs: 0,
    })
    .returning();

  if (report.issues.length) {
    await db.insert(issuesTable).values(
      report.issues.map((i, idx) => ({
        scanId: scanRow.id,
        severity: i.severity,
        title: i.title,
        filePath: i.filePath,
        lineNumber: i.lineNumber ?? null,
        category: i.category ?? null,
        impactMs: i.impactMs,
        problem: i.problem ?? null,
        codeBefore: i.codeBefore ?? null,
        codeAfter: i.codeAfter ?? null,
        sortOrder: idx,
      })),
    );
  }

  const publicHost = process.env.PUBLIC_URL ?? 'http://localhost:5000';
  return c.json({
    id: scanRow.id,
    url: `${publicHost}/prs/${pr.number}/scans/${scanRow.id}`,
    verdict,
    verdictSub,
    p95LatencyMs: scanRow.p95LatencyMs,
    p95BaselineMs: scanRow.p95BaselineMs,
    cpuPct: scanRow.cpuPct,
    cpuBaselinePct: scanRow.cpuBaselinePct,
    dbQueries: scanRow.dbQueries,
    dbNPlusOne: scanRow.dbNPlusOne,
    cacheHitRate: scanRow.cacheHitRate,
    issues: report.issues,
  });
});

export default ingest;
