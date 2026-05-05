import { db, migrate } from './index.ts';

migrate();

db.exec('DELETE FROM trace_spans');
db.exec('DELETE FROM time_distribution');
db.exec('DELETE FROM flame_blocks');
db.exec('DELETE FROM flame_rows');
db.exec('DELETE FROM flame_axis');
db.exec('DELETE FROM gates');
db.exec('DELETE FROM issues');
db.exec('DELETE FROM scans');
db.exec('DELETE FROM architecture_suggestions');
db.exec('DELETE FROM pull_requests');
db.exec('DELETE FROM repos');
db.exec('DELETE FROM users');
db.exec('DELETE FROM departments');

// ── departments ─────────────────────────────────────────────────────────────
const insertDept = db.prepare(`INSERT INTO departments (name) VALUES (?) RETURNING id`);
const deptIds = {
  Platform: (insertDept.get('Platform') as { id: number }).id,
  Growth: (insertDept.get('Growth') as { id: number }).id,
  Reliability: (insertDept.get('Reliability') as { id: number }).id,
};

// ── users ───────────────────────────────────────────────────────────────────
const insertUser = db.prepare(
  `INSERT INTO users (email, name, role, github_username, initials, department_id) VALUES (?, ?, ?, ?, ?, ?)`,
);
const users: Array<[string, string, string, string, string, number]> = [
  ['jane.doe@waste-labs.io', 'Jane Doe', 'admin', 'jdoe', 'JD', deptIds.Platform],
  ['marcus.lee@waste-labs.io', 'Marcus Lee', 'engineer', 'mlee', 'ML', deptIds.Platform],
  ['lin.wei@waste-labs.io', 'Lin Wei', 'engineer', 'lwei', 'LW', deptIds.Platform],
  ['priya.shah@waste-labs.io', 'Priya Shah', 'engineer', 'pshah', 'PS', deptIds.Growth],
  ['alex.kim@waste-labs.io', 'Alex Kim', 'lead', 'akim', 'AK', deptIds.Growth],
  ['noah.patel@waste-labs.io', 'Noah Patel', 'engineer', 'npatel', 'NP', deptIds.Growth],
  ['sam.rivera@waste-labs.io', 'Sam Rivera', 'lead', 'srivera', 'SR', deptIds.Reliability],
  ['tom.brennan@waste-labs.io', 'Tom Brennan', 'engineer', 'tbrennan', 'TB', deptIds.Reliability],
];
users.forEach((u) => insertUser.run(...u));

// ── repos ───────────────────────────────────────────────────────────────────
const insertRepo = db.prepare(
  `INSERT INTO repos (owner, name, department_id) VALUES (?, ?, ?) RETURNING id`,
);
const repoIds = {
  checkout: (insertRepo.get('waste-labs', 'checkout-service', deptIds.Platform) as { id: number }).id,
  analytics: (insertRepo.get('waste-labs', 'analytics-pipeline', deptIds.Growth) as { id: number }).id,
  billing: (insertRepo.get('waste-labs', 'billing-service', deptIds.Growth) as { id: number }).id,
  observability: (insertRepo.get('waste-labs', 'observability', deptIds.Reliability) as { id: number }).id,
  gateway: (insertRepo.get('waste-labs', 'gateway', deptIds.Reliability) as { id: number }).id,
};

// ── pull_requests ───────────────────────────────────────────────────────────
const insertPR = db.prepare(
  `INSERT INTO pull_requests (
     repo_id, number, title, branch, base_branch, commits, files_changed, author,
     status, github_url, improvement, business_value, hours_saved
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
);

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

const prRows = prSeeds.map((p) => ({
  ...p,
  prId: (
    insertPR.get(
      p.repoId, p.number, p.title, p.branch, 'main', p.commits, p.files, p.author,
      p.status, `https://github.com/${p.ownerName}/pull/${p.number}`,
      p.improvement, p.businessValue, p.hoursSaved,
    ) as { id: number }
  ).id,
}));

const dashboardPR = prRows.find((p) => p.number === 2847)!;

// ── full scan for PR #2847 ──────────────────────────────────────────────────
const profiledAt = Date.now() - 3 * 60 * 1000 - 42 * 1000;
const scanId = (db.prepare(
  `INSERT INTO scans (
    pr_id, verdict, verdict_sub, profiled_at,
    p95_latency_ms, p95_baseline_ms, cpu_pct, cpu_baseline_pct,
    db_queries, db_n_plus_one, cache_hit_rate, cache_baseline,
    autofix_count, autofix_total, autofix_savings_ms
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
).get(
  dashboardPR.prId, 'FAILED', '3 critical regressions blocking merge', profiledAt,
  847, 206, 82, 35, 1247, 184, 12, 88, 5, 7, 671,
) as { id: number }).id;

// lightweight scans for other PRs
const lightScan = db.prepare(
  `INSERT INTO scans (
    pr_id, verdict, verdict_sub, profiled_at,
    p95_latency_ms, p95_baseline_ms, cpu_pct, cpu_baseline_pct,
    db_queries, db_n_plus_one, cache_hit_rate, cache_baseline,
    autofix_count, autofix_total, autofix_savings_ms
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const lightScanData: Array<[number, string, string, number, number, number, number, number, number, number, number, number]> = [
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
for (const [idx, verdict, sub, p95, base, cpu, cpuB, q, npo, cache, cacheB, savings] of lightScanData) {
  const pr = prRows[idx];
  lightScan.run(
    pr.prId, verdict as string, sub as string, Date.now() - (idx + 1) * 60 * 60 * 1000,
    p95 as number, base as number, cpu as number, cpuB as number,
    q as number, npo as number, cache as number, cacheB as number,
    npo === 0 ? 0 : 1, npo === 0 ? 0 : 2, savings as number,
  );
}

// ── issues for PR #2847 ─────────────────────────────────────────────────────
const insertIssue = db.prepare(`
  INSERT INTO issues (
    scan_id, severity, title, file_path, line_number, meta, category, impact_ms,
    problem, code_before, code_after, code_lang, code_diff_label,
    suggestion_title, suggestion_text, sort_order
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const issues: Array<Parameters<typeof insertIssue.run>> = [
  [
    scanId, 'critical',
    'N+1 Query Pattern in User Dashboard Loader',
    'src/services/UserService.ts', 47,
    '184 queries × ~2.1ms each · Database overuse',
    'database', 387,
    'Each user in the dashboard list triggers a separate query to fetch their order history. With 184 active users, this generates 184 sequential DB round-trips instead of a single batched query.',
    `const users = await userRepo.findAll();\nfor (const user of users) {\n  user.orders = await ordersRepo.findByUserId(user.id); // N+1\n}`,
    `const users = await userRepo.findAll();\nconst orders = await ordersRepo.findByUserIds(users.map(u => u.id));\nconst ordersByUser = _.groupBy(orders, 'userId');\nusers.forEach(u => u.orders = ordersByUser[u.id] ?? []);`,
    'TypeScript', 'Replace with batched IN-query',
    'Estimated improvement: ~370ms saved per request',
    'Reduces DB round-trips from 184 → 1. Combined with cache layer (see Issue #3) could bring this path under 50ms.',
    1,
  ],
  [
    scanId, 'critical',
    'Blocking Synchronous I/O on Hot Path',
    'src/api/dashboard.handler.ts', 112,
    'fs.readFileSync blocks event loop for ~80ms',
    'io', 82,
    'A synchronous file read inside the request handler blocks the Node.js event loop, starving all concurrent requests. Under load (50 RPS), this cascades into thread pool exhaustion.',
    `const template = fs.readFileSync('./templates/dash.html'); // blocks!`,
    null, 'TypeScript', null,
    'Move to startup, or use async fs.promises.readFile',
    'Templates should be loaded once at boot and cached in memory. Eliminates 80ms blocking per request.',
    2,
  ],
  [
    scanId, 'critical',
    'Redis Cache Bypassed — Direct DB Reads on Hot Object',
    'src/services/UserService.ts', 23,
    'UserPreferences fetched 1,200×/min, 0% cached',
    'cache', 94,
    'The new getUserPreferences() implementation removed the Redis lookup that existed in the previous version. This object changes <1×/day per user but is now read from Postgres on every request.',
    null,
    `const cacheKey = \`prefs:\${userId}\`;\nconst cached = await redis.get(cacheKey);\nif (cached) return JSON.parse(cached);\nconst prefs = await prefsRepo.findByUserId(userId);\nawait redis.setex(cacheKey, 300, JSON.stringify(prefs));`,
    'TypeScript', 'Cache-aside with 5min TTL',
    null, null, 3,
  ],
  [scanId, 'high', 'CPU-bound JSON serialization on large payload', 'src/api/dashboard.handler.ts', 201, '14% of total CPU time', 'cpu', 118, null, null, null, 'TypeScript', null, null, null, 4],
  [scanId, 'high', 'Missing index on `orders.user_id` causes full table scan', 'migrations/0024_orders.sql', null, 'Avg query: 22ms (should be <1ms)', 'database', 62, null, null, null, 'SQL', null, null, null, 5],
  [scanId, 'medium', 'Unbounded array growth — possible memory pressure', 'src/services/MetricsBuffer.ts', 18, 'Heap grew 340MB during 5min profile', 'memory', 24, null, null, null, 'TypeScript', null, null, null, 6],
  [scanId, 'low', 'Redundant logger.info call in tight loop', 'src/utils/processItems.ts', 34, 'Called 1,800×/sec at INFO level', 'logging', 8, null, null, null, 'TypeScript', null, null, null, 7],
];
for (const i of issues) insertIssue.run(...i);

const insertGate = db.prepare(
  `INSERT INTO gates (scan_id, name, value, status, sort_order) VALUES (?, ?, ?, ?, ?)`,
);
const gates = [
  ['P95 latency < 300ms', '847ms', 'fail'],
  ['DB queries / req < 20', '1,247', 'fail'],
  ['Cache hit rate > 80%', '12%', 'fail'],
  ['CPU usage < 70%', '82%', 'warn'],
  ['No memory leaks', 'OK', 'pass'],
  ['Error rate < 0.1%', '0.02%', 'pass'],
  ['No deadlocks detected', 'OK', 'pass'],
];
gates.forEach((g, idx) => insertGate.run(scanId, g[0], g[1], g[2], idx + 1));

const insertRow = db.prepare(`INSERT INTO flame_rows (scan_id, depth) VALUES (?, ?) RETURNING id`);
const insertBlock = db.prepare(
  `INSERT INTO flame_blocks (row_id, label, flex, pct, heat, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
);
type Block = { label: string; flex: number; pct: number | null; heat: string };
const flameRows: Block[][] = [
  [{ label: 'main.handleRequest', flex: 1, pct: 100, heat: 'faded' }],
  [{ label: 'auth', flex: 0.08, pct: 8, heat: 'faded' }, { label: 'DashboardController.load', flex: 0.84, pct: 84, heat: 'hot' }, { label: 'render', flex: 0.08, pct: 8, heat: 'faded' }],
  [{ label: '', flex: 0.08, pct: null, heat: 'faded' }, { label: 'UserService.getUserStats', flex: 0.62, pct: 62, heat: 'hot' }, { label: 'OrdersRepo.findAll', flex: 0.22, pct: 22, heat: 'warm' }, { label: '', flex: 0.08, pct: null, heat: 'faded' }],
  [{ label: '', flex: 0.08, pct: null, heat: 'faded' }, { label: 'db.query (×184 N+1)', flex: 0.48, pct: 48, heat: 'hot' }, { label: 'jsonSerialize', flex: 0.14, pct: 14, heat: 'cool' }, { label: 'SQL.fullScan', flex: 0.22, pct: 22, heat: 'warm' }, { label: '', flex: 0.08, pct: null, heat: 'faded' }],
  [{ label: '', flex: 0.08, pct: null, heat: 'faded' }, { label: 'socket.read', flex: 0.32, pct: 32, heat: 'hot' }, { label: 'deserialize', flex: 0.16, pct: 16, heat: 'warm' }, { label: '', flex: 0.14, pct: null, heat: 'cool' }, { label: 'heap.scan', flex: 0.22, pct: 22, heat: 'mild' }, { label: '', flex: 0.08, pct: null, heat: 'faded' }],
  [{ label: '', flex: 0.08, pct: null, heat: 'faded' }, { label: 'syscall.recv', flex: 0.18, pct: 18, heat: 'hot' }, { label: 'tcp.wait', flex: 0.14, pct: 14, heat: 'warm' }, { label: '', flex: 0.14, pct: null, heat: 'cool' }, { label: '', flex: 0.46, pct: null, heat: 'calm' }, { label: '', flex: 0.08, pct: null, heat: 'faded' }],
];
flameRows.forEach((row, depth) => {
  const r = insertRow.get(scanId, depth) as { id: number };
  row.forEach((b, i) => insertBlock.run(r.id, b.label, b.flex, b.pct, b.heat, i));
});

const insertAxis = db.prepare(
  `INSERT INTO flame_axis (scan_id, label, offset_pct, sort_order) VALUES (?, ?, ?, ?)`,
);
[['0ms', 0], ['210ms', 25], ['420ms', 50], ['630ms', 75], ['847ms', 100]].forEach(
  (a, i) => insertAxis.run(scanId, a[0] as string, a[1] as number, i),
);

const insertTd = db.prepare(
  `INSERT INTO time_distribution (scan_id, name, pct, level, sort_order) VALUES (?, ?, ?, ?, ?)`,
);
const tds = [['Database', 48, 'high'], ['CPU', 22, 'med'], ['I/O Wait', 18, 'med'], ['Network', 8, 'low'], ['Cache', 4, 'low']];
tds.forEach((t, i) => insertTd.run(scanId, t[0] as string, t[1] as number, t[2] as string, i));

const insertSpan = db.prepare(
  `INSERT INTO trace_spans (scan_id, label, kind, offset_pct, width_pct, time_ms, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
);
const spans = [
  ['auth.verify', 'cpu', 0, 2, 14],
  ['db.findUsers', 'db', 2, 6, 52],
  ['db.orders ×184', 'db', 8, 46, 387],
  ['fs.readSync', 'io', 54, 10, 82],
  ['prefs.fetch', 'db', 64, 11, 94],
  ['json.serialize', 'cpu', 75, 14, 118],
  ['response.send', 'io', 89, 11, 100],
];
spans.forEach((s, i) => insertSpan.run(scanId, s[0] as string, s[1] as string, s[2] as number, s[3] as number, s[4] as number, i));

// ── architecture suggestions ────────────────────────────────────────────────
const insertArch = db.prepare(
  `INSERT INTO architecture_suggestions
   (title, description, github_url, business_value, hours_saved, repo_id, department_id, status, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const now = Date.now();
const archRows: Array<Parameters<typeof insertArch.run>> = [
  ['Migrate event bus to Kafka', 'Replace the in-house RabbitMQ event bus with Kafka to support replay, partitioning, and exactly-once semantics across the platform. Foundational for the analytics CDC migration.', 'https://github.com/waste-labs/checkout-service/issues/3104', 120000, 600, repoIds.checkout, deptIds.Platform, 'proposed', now - 7 * 86400000],
  ['Consolidate billing & checkout into shared Payments service', 'Both checkout-service and billing-service duplicate Stripe call patterns and tokenization logic. Extract a shared Payments service with stable contract.', 'https://github.com/waste-labs/checkout-service/issues/3198', 80000, 400, repoIds.billing, deptIds.Platform, 'review', now - 14 * 86400000],
  ['Adopt OpenTelemetry across all services', 'Replace per-service tracing libs with OTel SDK; export to a single collector. Removes 3 maintenance burdens and unifies trace context propagation.', 'https://github.com/waste-labs/observability/issues/512', 45000, 240, repoIds.observability, deptIds.Reliability, 'proposed', now - 21 * 86400000],
  ['Replace polling-based analytics with CDC', 'Move all batch ETL pulls to change-data-capture via Debezium → Kafka → Materialized views. Reduces lag from 30s to <1s and removes load on primary.', 'https://github.com/waste-labs/analytics-pipeline/issues/889', 90000, 500, repoIds.analytics, deptIds.Growth, 'proposed', now - 4 * 86400000],
];
for (const a of archRows) insertArch.run(...a);

console.log(
  `✓ Seeded ${Object.keys(deptIds).length} depts, ${users.length} users, ` +
  `${Object.keys(repoIds).length} repos, ${prRows.length} PRs (1 full scan + ${lightScanData.length} light scans), ` +
  `${issues.length} issues, ${gates.length} gates, ${flameRows.length} flame rows, ${spans.length} trace spans, ${archRows.length} arch suggestions`,
);
