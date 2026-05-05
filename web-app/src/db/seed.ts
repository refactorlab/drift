import { db } from './index.ts';
import {
  departments,
  users,
  repos,
  pullRequests,
  scans,
  issues,
  gates,
  flameRows,
  flameBlocks,
  flameAxis,
  timeDistribution,
  traceSpans,
  architectureSuggestions,
} from './schema.ts';

// Truncate in dependency-safe order. We restart identities so subsequent IDs
// always start at 1 and the demo PR #2847 maps to a stable scan_id.
await db.execute(/* sql */ `
  TRUNCATE TABLE
    trace_spans,
    time_distribution,
    flame_blocks,
    flame_rows,
    flame_axis,
    gates,
    issues,
    scans,
    architecture_suggestions,
    pull_requests,
    repos,
    users,
    departments
  RESTART IDENTITY CASCADE
`);

// ── departments ─────────────────────────────────────────────────────────────
const deptRows = await db
  .insert(departments)
  .values([{ name: 'Platform' }, { name: 'Growth' }, { name: 'Reliability' }])
  .returning();
const deptIds = {
  Platform: deptRows.find((d) => d.name === 'Platform')!.id,
  Growth: deptRows.find((d) => d.name === 'Growth')!.id,
  Reliability: deptRows.find((d) => d.name === 'Reliability')!.id,
};

// ── users ───────────────────────────────────────────────────────────────────
await db.insert(users).values([
  { email: 'jane.doe@waste-labs.io', name: 'Jane Doe', role: 'admin', githubUsername: 'jdoe', initials: 'JD', departmentId: deptIds.Platform },
  { email: 'marcus.lee@waste-labs.io', name: 'Marcus Lee', role: 'engineer', githubUsername: 'mlee', initials: 'ML', departmentId: deptIds.Platform },
  { email: 'lin.wei@waste-labs.io', name: 'Lin Wei', role: 'engineer', githubUsername: 'lwei', initials: 'LW', departmentId: deptIds.Platform },
  { email: 'priya.shah@waste-labs.io', name: 'Priya Shah', role: 'engineer', githubUsername: 'pshah', initials: 'PS', departmentId: deptIds.Growth },
  { email: 'alex.kim@waste-labs.io', name: 'Alex Kim', role: 'lead', githubUsername: 'akim', initials: 'AK', departmentId: deptIds.Growth },
  { email: 'noah.patel@waste-labs.io', name: 'Noah Patel', role: 'engineer', githubUsername: 'npatel', initials: 'NP', departmentId: deptIds.Growth },
  { email: 'sam.rivera@waste-labs.io', name: 'Sam Rivera', role: 'lead', githubUsername: 'srivera', initials: 'SR', departmentId: deptIds.Reliability },
  { email: 'tom.brennan@waste-labs.io', name: 'Tom Brennan', role: 'engineer', githubUsername: 'tbrennan', initials: 'TB', departmentId: deptIds.Reliability },
]);

// ── repos ───────────────────────────────────────────────────────────────────
const repoRows = await db
  .insert(repos)
  .values([
    { owner: 'waste-labs', name: 'checkout-service', departmentId: deptIds.Platform },
    { owner: 'waste-labs', name: 'analytics-pipeline', departmentId: deptIds.Growth },
    { owner: 'waste-labs', name: 'billing-service', departmentId: deptIds.Growth },
    { owner: 'waste-labs', name: 'observability', departmentId: deptIds.Reliability },
    { owner: 'waste-labs', name: 'gateway', departmentId: deptIds.Reliability },
  ])
  .returning();
const repoIds = {
  checkout: repoRows.find((r) => r.name === 'checkout-service')!.id,
  analytics: repoRows.find((r) => r.name === 'analytics-pipeline')!.id,
  billing: repoRows.find((r) => r.name === 'billing-service')!.id,
  observability: repoRows.find((r) => r.name === 'observability')!.id,
  gateway: repoRows.find((r) => r.name === 'gateway')!.id,
};

// ── pull_requests ───────────────────────────────────────────────────────────
type PRSeed = {
  repoId: number; ownerName: string; number: number; title: string;
  branch: string; commits: number; files: number; author: string;
  status: 'pending' | 'approved' | 'merged';
  improvement: string; businessValue: number; hoursSaved: number;
};

const prSeeds: PRSeed[] = [
  { repoId: repoIds.checkout, ownerName: 'waste-labs/checkout-service', number: 2847, title: 'feat: refactor user dashboard data loading', branch: 'feature/dashboard-refactor', commits: 14, files: 23, author: 'jdoe', status: 'pending', improvement: 'Eliminates N+1 queries; restores Redis cache layer; moves blocking I/O off hot path.', businessValue: 24000, hoursSaved: 180 },
  { repoId: repoIds.checkout, ownerName: 'waste-labs/checkout-service', number: 2851, title: 'fix: cache user preferences with 5min TTL', branch: 'fix/prefs-cache', commits: 3, files: 4, author: 'lwei', status: 'pending', improvement: 'Adds Redis cache-aside for getUserPreferences (changes <1×/day, was DB-hit per request).', businessValue: 8000, hoursSaved: 32 },
  { repoId: repoIds.checkout, ownerName: 'waste-labs/checkout-service', number: 2840, title: 'perf: batch order queries with IN clause', branch: 'perf/batch-orders', commits: 6, files: 9, author: 'mlee', status: 'approved', improvement: 'Removes N+1 in OrdersRepo by batching with WHERE user_id IN (?, ?…).', businessValue: 15000, hoursSaved: 96 },
  { repoId: repoIds.checkout, ownerName: 'waste-labs/checkout-service', number: 2832, title: 'perf: add btree index on orders.user_id', branch: 'perf/orders-index', commits: 1, files: 1, author: 'mlee', status: 'approved', improvement: 'Drops avg query from 22ms to <1ms via index on hot column.', businessValue: 6000, hoursSaved: 18 },
  { repoId: repoIds.analytics, ownerName: 'waste-labs/analytics-pipeline', number: 314, title: 'feat: stream events with Debezium instead of polling', branch: 'feature/cdc-stream', commits: 22, files: 41, author: 'pshah', status: 'pending', improvement: 'Replaces 30s poll with CDC; reduces lag from 30s → <1s end-to-end.', businessValue: 42000, hoursSaved: 240 },
  { repoId: repoIds.analytics, ownerName: 'waste-labs/analytics-pipeline', number: 309, title: 'perf: vectorize daily aggregations', branch: 'perf/vector-agg', commits: 8, files: 12, author: 'akim', status: 'approved', improvement: 'Replaces python loops with numpy ufuncs; 18× faster nightly job.', businessValue: 18000, hoursSaved: 80 },
  { repoId: repoIds.billing, ownerName: 'waste-labs/billing-service', number: 157, title: 'fix: dedupe Stripe customer.retrieve calls', branch: 'fix/stripe-dedupe', commits: 5, files: 7, author: 'npatel', status: 'pending', improvement: 'Memoizes Stripe lookups per request; saves ~200ms × 1.2M calls/mo.', businessValue: 12000, hoursSaved: 60 },
  { repoId: repoIds.billing, ownerName: 'waste-labs/billing-service', number: 150, title: 'perf: use prepared statements for invoice queries', branch: 'perf/prepared-statements', commits: 4, files: 6, author: 'akim', status: 'approved', improvement: 'Cuts query parse time on hot invoice path; saves ~12ms p95.', businessValue: 4000, hoursSaved: 24 },
  { repoId: repoIds.observability, ownerName: 'waste-labs/observability', number: 421, title: 'chore: drop unused Prometheus metrics', branch: 'chore/drop-metrics', commits: 2, files: 5, author: 'tbrennan', status: 'approved', improvement: 'Removes 47 unused gauges/counters; cuts scrape memory ~28%.', businessValue: 3500, hoursSaved: 12 },
  { repoId: repoIds.observability, ownerName: 'waste-labs/observability', number: 418, title: 'fix: rate-limit log shipper to avoid backpressure', branch: 'fix/log-shipper-rl', commits: 3, files: 3, author: 'srivera', status: 'approved', improvement: 'Adds token-bucket to fluentbit; eliminates upstream stall on bursts.', businessValue: 9000, hoursSaved: 40 },
  { repoId: repoIds.gateway, ownerName: 'waste-labs/gateway', number: 88, title: 'perf: enable HTTP keep-alive connection pool', branch: 'perf/keep-alive', commits: 4, files: 6, author: 'srivera', status: 'pending', improvement: 'Reuses upstream TCP connections; halves new conn handshake CPU.', businessValue: 16000, hoursSaved: 72 },
  { repoId: repoIds.gateway, ownerName: 'waste-labs/gateway', number: 82, title: 'fix: TLS session resumption to remove handshake bottleneck', branch: 'fix/tls-resumption', commits: 7, files: 11, author: 'tbrennan', status: 'approved', improvement: 'Enables TLS 1.3 0-RTT; removes 80ms handshake on warm connections.', businessValue: 22000, hoursSaved: 120 },
];

const prRows = await db
  .insert(pullRequests)
  .values(
    prSeeds.map((p) => ({
      repoId: p.repoId,
      number: p.number,
      title: p.title,
      branch: p.branch,
      baseBranch: 'main',
      commits: p.commits,
      filesChanged: p.files,
      author: p.author,
      status: p.status,
      githubUrl: `https://github.com/${p.ownerName}/pull/${p.number}`,
      improvement: p.improvement,
      businessValue: p.businessValue,
      hoursSaved: p.hoursSaved,
    })),
  )
  .returning({ id: pullRequests.id, number: pullRequests.number });

const prByNumber = new Map(prRows.map((r) => [r.number, r.id]));
const dashboardPRId = prByNumber.get(2847)!;

// ── full scan for PR #2847 ──────────────────────────────────────────────────
const profiledAt = Date.now() - 3 * 60 * 1000 - 42 * 1000;
const [scanRow] = await db
  .insert(scans)
  .values({
    prId: dashboardPRId,
    verdict: 'FAILED',
    verdictSub: '3 critical regressions blocking merge',
    profiledAt,
    p95LatencyMs: 847, p95BaselineMs: 206,
    cpuPct: 82, cpuBaselinePct: 35,
    dbQueries: 1247, dbNPlusOne: 184,
    cacheHitRate: 12, cacheBaseline: 88,
    autofixCount: 5, autofixTotal: 7, autofixSavingsMs: 671,
  })
  .returning({ id: scans.id });
const scanId = scanRow.id;

// lightweight scans for other PRs (indexed by their PR # in prSeeds order)
const lightScanData: Array<[number, 'PASSED' | 'WARN' | 'FAILED', string, number, number, number, number, number, number, number, number, number]> = [
  [1, 'PASSED', 'all gates pass', 198, 206, 32, 35, 18, 0, 91, 88, 0],
  [2, 'PASSED', 'meets perf budget', 142, 206, 28, 35, 14, 0, 94, 88, 0],
  [3, 'PASSED', 'index drops query time', 95, 206, 22, 35, 12, 0, 90, 88, 0],
  [4, 'WARN', '1 budget close to limit', 280, 320, 64, 60, 240, 0, 78, 80, 80],
  [5, 'PASSED', 'aggregation 18× faster', 150, 320, 48, 60, 80, 0, 82, 80, 0],
  [6, 'WARN', 'Stripe dedupe partial', 410, 420, 38, 40, 90, 12, 72, 80, 60],
  [7, 'PASSED', 'prepared stmt cache', 220, 420, 30, 40, 60, 0, 86, 80, 0],
  [8, 'PASSED', 'metrics removed', 80, 110, 20, 30, 8, 0, 98, 95, 0],
  [9, 'PASSED', 'shipper stable', 95, 110, 24, 30, 14, 0, 96, 95, 0],
  [10, 'WARN', 'pool not fully tuned', 340, 380, 58, 55, 180, 0, 70, 75, 90],
  [11, 'PASSED', 'TLS bottleneck gone', 210, 380, 42, 55, 80, 0, 84, 75, 0],
];

await db.insert(scans).values(
  lightScanData.map(([idx, verdict, sub, p95, base, cpu, cpuB, q, npo, cache, cacheB, savings]) => {
    const pr = prRows[idx];
    return {
      prId: pr.id,
      verdict,
      verdictSub: sub,
      profiledAt: Date.now() - (idx + 1) * 60 * 60 * 1000,
      p95LatencyMs: p95, p95BaselineMs: base,
      cpuPct: cpu, cpuBaselinePct: cpuB,
      dbQueries: q, dbNPlusOne: npo,
      cacheHitRate: cache, cacheBaseline: cacheB,
      autofixCount: npo === 0 ? 0 : 1,
      autofixTotal: npo === 0 ? 0 : 2,
      autofixSavingsMs: savings,
    };
  }),
);

// ── issues for PR #2847 ─────────────────────────────────────────────────────
await db.insert(issues).values([
  {
    scanId, severity: 'critical',
    title: 'N+1 Query Pattern in User Dashboard Loader',
    filePath: 'src/services/UserService.ts', lineNumber: 47,
    meta: '184 queries × ~2.1ms each · Database overuse',
    category: 'database', impactMs: 387,
    problem: 'Each user in the dashboard list triggers a separate query to fetch their order history. With 184 active users, this generates 184 sequential DB round-trips instead of a single batched query.',
    codeBefore: `const users = await userRepo.findAll();\nfor (const user of users) {\n  user.orders = await ordersRepo.findByUserId(user.id); // N+1\n}`,
    codeAfter: `const users = await userRepo.findAll();\nconst orders = await ordersRepo.findByUserIds(users.map(u => u.id));\nconst ordersByUser = _.groupBy(orders, 'userId');\nusers.forEach(u => u.orders = ordersByUser[u.id] ?? []);`,
    codeLang: 'TypeScript', codeDiffLabel: 'Replace with batched IN-query',
    suggestionTitle: 'Estimated improvement: ~370ms saved per request',
    suggestionText: 'Reduces DB round-trips from 184 → 1. Combined with cache layer (see Issue #3) could bring this path under 50ms.',
    sortOrder: 1,
  },
  {
    scanId, severity: 'critical',
    title: 'Blocking Synchronous I/O on Hot Path',
    filePath: 'src/api/dashboard.handler.ts', lineNumber: 112,
    meta: 'fs.readFileSync blocks event loop for ~80ms',
    category: 'io', impactMs: 82,
    problem: 'A synchronous file read inside the request handler blocks the Node.js event loop, starving all concurrent requests. Under load (50 RPS), this cascades into thread pool exhaustion.',
    codeBefore: `const template = fs.readFileSync('./templates/dash.html'); // blocks!`,
    codeAfter: null, codeLang: 'TypeScript', codeDiffLabel: null,
    suggestionTitle: 'Move to startup, or use async fs.promises.readFile',
    suggestionText: 'Templates should be loaded once at boot and cached in memory. Eliminates 80ms blocking per request.',
    sortOrder: 2,
  },
  {
    scanId, severity: 'critical',
    title: 'Redis Cache Bypassed — Direct DB Reads on Hot Object',
    filePath: 'src/services/UserService.ts', lineNumber: 23,
    meta: 'UserPreferences fetched 1,200×/min, 0% cached',
    category: 'cache', impactMs: 94,
    problem: 'The new getUserPreferences() implementation removed the Redis lookup that existed in the previous version. This object changes <1×/day per user but is now read from Postgres on every request.',
    codeBefore: null,
    codeAfter: `const cacheKey = \`prefs:\${userId}\`;\nconst cached = await redis.get(cacheKey);\nif (cached) return JSON.parse(cached);\nconst prefs = await prefsRepo.findByUserId(userId);\nawait redis.setex(cacheKey, 300, JSON.stringify(prefs));`,
    codeLang: 'TypeScript', codeDiffLabel: 'Cache-aside with 5min TTL',
    suggestionTitle: null, suggestionText: null, sortOrder: 3,
  },
  { scanId, severity: 'high', title: 'CPU-bound JSON serialization on large payload', filePath: 'src/api/dashboard.handler.ts', lineNumber: 201, meta: '14% of total CPU time', category: 'cpu', impactMs: 118, problem: null, codeBefore: null, codeAfter: null, codeLang: 'TypeScript', codeDiffLabel: null, suggestionTitle: null, suggestionText: null, sortOrder: 4 },
  { scanId, severity: 'high', title: 'Missing index on `orders.user_id` causes full table scan', filePath: 'migrations/0024_orders.sql', lineNumber: null, meta: 'Avg query: 22ms (should be <1ms)', category: 'database', impactMs: 62, problem: null, codeBefore: null, codeAfter: null, codeLang: 'SQL', codeDiffLabel: null, suggestionTitle: null, suggestionText: null, sortOrder: 5 },
  { scanId, severity: 'medium', title: 'Unbounded array growth — possible memory pressure', filePath: 'src/services/MetricsBuffer.ts', lineNumber: 18, meta: 'Heap grew 340MB during 5min profile', category: 'memory', impactMs: 24, problem: null, codeBefore: null, codeAfter: null, codeLang: 'TypeScript', codeDiffLabel: null, suggestionTitle: null, suggestionText: null, sortOrder: 6 },
  { scanId, severity: 'low', title: 'Redundant logger.info call in tight loop', filePath: 'src/utils/processItems.ts', lineNumber: 34, meta: 'Called 1,800×/sec at INFO level', category: 'logging', impactMs: 8, problem: null, codeBefore: null, codeAfter: null, codeLang: 'TypeScript', codeDiffLabel: null, suggestionTitle: null, suggestionText: null, sortOrder: 7 },
]);

// ── gates ───────────────────────────────────────────────────────────────────
const gateData = [
  ['P95 latency < 300ms', '847ms', 'fail'],
  ['DB queries / req < 20', '1,247', 'fail'],
  ['Cache hit rate > 80%', '12%', 'fail'],
  ['CPU usage < 70%', '82%', 'warn'],
  ['No memory leaks', 'OK', 'pass'],
  ['Error rate < 0.1%', '0.02%', 'pass'],
  ['No deadlocks detected', 'OK', 'pass'],
];
await db.insert(gates).values(
  gateData.map((g, i) => ({ scanId, name: g[0], value: g[1], status: g[2], sortOrder: i + 1 })),
);

// ── flame graph ─────────────────────────────────────────────────────────────
type Block = { label: string; flex: number; pct: number | null; heat: string };
const flameRowData: Block[][] = [
  [{ label: 'main.handleRequest', flex: 1, pct: 100, heat: 'faded' }],
  [{ label: 'auth', flex: 0.08, pct: 8, heat: 'faded' }, { label: 'DashboardController.load', flex: 0.84, pct: 84, heat: 'hot' }, { label: 'render', flex: 0.08, pct: 8, heat: 'faded' }],
  [{ label: '', flex: 0.08, pct: null, heat: 'faded' }, { label: 'UserService.getUserStats', flex: 0.62, pct: 62, heat: 'hot' }, { label: 'OrdersRepo.findAll', flex: 0.22, pct: 22, heat: 'warm' }, { label: '', flex: 0.08, pct: null, heat: 'faded' }],
  [{ label: '', flex: 0.08, pct: null, heat: 'faded' }, { label: 'db.query (×184 N+1)', flex: 0.48, pct: 48, heat: 'hot' }, { label: 'jsonSerialize', flex: 0.14, pct: 14, heat: 'cool' }, { label: 'SQL.fullScan', flex: 0.22, pct: 22, heat: 'warm' }, { label: '', flex: 0.08, pct: null, heat: 'faded' }],
  [{ label: '', flex: 0.08, pct: null, heat: 'faded' }, { label: 'socket.read', flex: 0.32, pct: 32, heat: 'hot' }, { label: 'deserialize', flex: 0.16, pct: 16, heat: 'warm' }, { label: '', flex: 0.14, pct: null, heat: 'cool' }, { label: 'heap.scan', flex: 0.22, pct: 22, heat: 'mild' }, { label: '', flex: 0.08, pct: null, heat: 'faded' }],
  [{ label: '', flex: 0.08, pct: null, heat: 'faded' }, { label: 'syscall.recv', flex: 0.18, pct: 18, heat: 'hot' }, { label: 'tcp.wait', flex: 0.14, pct: 14, heat: 'warm' }, { label: '', flex: 0.14, pct: null, heat: 'cool' }, { label: '', flex: 0.46, pct: null, heat: 'calm' }, { label: '', flex: 0.08, pct: null, heat: 'faded' }],
];
const insertedRows = await db
  .insert(flameRows)
  .values(flameRowData.map((_, depth) => ({ scanId, depth })))
  .returning({ id: flameRows.id, depth: flameRows.depth });
const blockValues = insertedRows.flatMap((r) =>
  flameRowData[r.depth].map((b, i) => ({
    rowId: r.id, label: b.label, flex: b.flex, pct: b.pct, heat: b.heat, sortOrder: i,
  })),
);
await db.insert(flameBlocks).values(blockValues);

// ── flame axis ──────────────────────────────────────────────────────────────
const axisData: Array<[string, number]> = [['0ms', 0], ['210ms', 25], ['420ms', 50], ['630ms', 75], ['847ms', 100]];
await db.insert(flameAxis).values(
  axisData.map(([label, offsetPct], i) => ({ scanId, label, offsetPct, sortOrder: i })),
);

// ── time distribution ──────────────────────────────────────────────────────
const tdData: Array<[string, number, string]> = [
  ['Database', 48, 'high'], ['CPU', 22, 'med'], ['I/O Wait', 18, 'med'],
  ['Network', 8, 'low'], ['Cache', 4, 'low'],
];
await db.insert(timeDistribution).values(
  tdData.map(([name, pct, level], i) => ({ scanId, name, pct, level, sortOrder: i })),
);

// ── trace spans ────────────────────────────────────────────────────────────
const spanData: Array<[string, string, number, number, number]> = [
  ['auth.verify', 'cpu', 0, 2, 14],
  ['db.findUsers', 'db', 2, 6, 52],
  ['db.orders ×184', 'db', 8, 46, 387],
  ['fs.readSync', 'io', 54, 10, 82],
  ['prefs.fetch', 'db', 64, 11, 94],
  ['json.serialize', 'cpu', 75, 14, 118],
  ['response.send', 'io', 89, 11, 100],
];
await db.insert(traceSpans).values(
  spanData.map(([label, kind, offsetPct, widthPct, timeMs], i) => ({
    scanId, label, kind, offsetPct, widthPct, timeMs, sortOrder: i,
  })),
);

// ── architecture suggestions ────────────────────────────────────────────────
const now = Date.now();
await db.insert(architectureSuggestions).values([
  { title: 'Migrate event bus to Kafka', description: 'Replace the in-house RabbitMQ event bus with Kafka to support replay, partitioning, and exactly-once semantics across the platform. Foundational for the analytics CDC migration.', githubUrl: 'https://github.com/waste-labs/checkout-service/issues/3104', businessValue: 120000, hoursSaved: 600, repoId: repoIds.checkout, departmentId: deptIds.Platform, status: 'proposed', createdAt: now - 7 * 86400000 },
  { title: 'Consolidate billing & checkout into shared Payments service', description: 'Both checkout-service and billing-service duplicate Stripe call patterns and tokenization logic. Extract a shared Payments service with stable contract.', githubUrl: 'https://github.com/waste-labs/checkout-service/issues/3198', businessValue: 80000, hoursSaved: 400, repoId: repoIds.billing, departmentId: deptIds.Platform, status: 'review', createdAt: now - 14 * 86400000 },
  { title: 'Adopt OpenTelemetry across all services', description: 'Replace per-service tracing libs with OTel SDK; export to a single collector. Removes 3 maintenance burdens and unifies trace context propagation.', githubUrl: 'https://github.com/waste-labs/observability/issues/512', businessValue: 45000, hoursSaved: 240, repoId: repoIds.observability, departmentId: deptIds.Reliability, status: 'proposed', createdAt: now - 21 * 86400000 },
  { title: 'Replace polling-based analytics with CDC', description: 'Move all batch ETL pulls to change-data-capture via Debezium → Kafka → Materialized views. Reduces lag from 30s to <1s and removes load on primary.', githubUrl: 'https://github.com/waste-labs/analytics-pipeline/issues/889', businessValue: 90000, hoursSaved: 500, repoId: repoIds.analytics, departmentId: deptIds.Growth, status: 'proposed', createdAt: now - 4 * 86400000 },
]);

console.log(
  `✓ Seeded ${deptRows.length} depts, 8 users, ${repoRows.length} repos, ` +
  `${prRows.length} PRs (1 full scan + ${lightScanData.length} light scans), ` +
  `7 issues, ${gateData.length} gates, ${flameRowData.length} flame rows, ${spanData.length} trace spans, 4 arch suggestions`,
);
