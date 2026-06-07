#!/usr/bin/env bun
/**
 * collect.ts — UNLIMITED autonomous collector of *valuable PR review comments*.
 *
 * WHAT IT DOES
 *   Streams across GitHub repositories (auto-discovered & ranked by importance,
 *   not a fixed list), finds the most-discussed merged pull requests that match
 *   your criteria, pulls each PR's conversation comments, ranks them by
 *   reactions, and writes one Markdown file per PR into ./prs/. The value we
 *   keep is the *review prose* — what reviewers actually wrote.
 *
 * REPO IMPORTANCE (beyond raw stars)
 *   Discovery walks DOWN star buckets, but each repo must also clear an
 *   "importance" gate that thinks about more than popularity:
 *     • alive   — pushed since ACTIVE_SINCE
 *     • real code — primary language present and not in EXCLUDE_LANGS
 *                   (drops awesome-lists / books / roadmaps that top the charts)
 *     • collaborative — forks >= MIN_FORKS (real multi-author projects)
 *     • not archived
 *   A composite importance score (stars + forks + recency) is recorded so the
 *   index can rank the most consequential repos first.
 *
 * SCALE / STOP CONDITIONS (0 = unbounded on that axis)
 *   MAX_PRS    target number of PRs to collect          (e.g. 50000)
 *   MAX_REPOS  cap on how many repos to scan            (e.g. 50000)
 *   RUNTIME_MIN wall-clock budget in minutes            (0 = no time cap)
 *   It can therefore run for hours/days toward 50k.
 *
 * NO TOKEN REQUIRED
 *   Uses the public GitHub API unauthenticated. On a rate-limit it does NOT
 *   fail — it reads `x-ratelimit-reset` and SLEEPS until the window resets,
 *   then retries. (A GITHUB_TOKEN env var, if present, is used to go ~80x
 *   faster: 5000/hr vs 60/hr — optional but strongly recommended at 50k scale.)
 *
 * PROGRESS
 *   In a TTY it draws a live progress bar (collected/target, repos, rate, ETA).
 *   In a pipe/file it prints periodic status lines instead.
 *
 * RESUMABLE
 *   PRs whose Markdown already exists are skipped, so stop/restart any time.
 *
 * USAGE
 *   bun run research/pr-review-research/collect.ts
 *   MAX_PRS=50000 MAX_REPOS=50000 RUNTIME_MIN=0 bun run .../collect.ts
 *   MIN_STARS=2000 MIN_FORKS=200 REPO_LANG=rust bun run .../collect.ts
 *   REPOS="rust-lang/rust,golang/go" bun run .../collect.ts
 *   (or `make collect-pr-reviews LIMIT=50000 MAX_REPOS=50000 RUNTIME=0`)
 */

// Minimal ambient declarations so the file type-checks in any editor without
// pulling in @types/bun / @types/node. Bun provides these globals at runtime.
declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
  stdout: { isTTY?: boolean; write(s: string): void };
};
declare const Bun: {
  write(path: string, data: string): Promise<number>;
  file(path: string): { exists(): Promise<boolean>; text(): Promise<string> };
};

// ────────────────────────────────────────────────────────────────────────────
// Config (all overridable via environment variables)
// ────────────────────────────────────────────────────────────────────────────
const HERE = new URL(".", import.meta.url).pathname;
const OUT_DIR = `${HERE}prs`;
const MANIFEST = `${HERE}collect.manifest.json`;
const INDEX_MD = `${HERE}COLLECTED.md`;

// Stop conditions (0 = unbounded on that axis)
const MAX_PRS = num(process.env.MAX_PRS ?? process.env.LIMIT, 0);     // target # of PRs
const MAX_REPOS = num(process.env.MAX_REPOS, 0);                       // cap on repos scanned
const RUNTIME_MIN = num(process.env.RUNTIME_MIN ?? process.env.RUNTIME, 60); // wall-clock minutes

// Repo-importance criteria
const MIN_STARS = num(process.env.MIN_STARS, 1500);
const MIN_FORKS = num(process.env.MIN_FORKS, 80);
// NB: read REPO_LANG, never bare LANG — LANG is the OS locale env var (e.g. "C.UTF-8").
const REPO_LANG = (process.env.REPO_LANG ?? process.env.GH_LANG ?? "").trim();
const ACTIVE_SINCE = str(process.env.ACTIVE_SINCE, "2024-01-01");     // repo pushed since
// Drop non-code repos (awesome-lists, books, roadmaps) by primary language.
const EXCLUDE_LANGS = new Set((process.env.EXCLUDE_LANGS ?? "Markdown,Text,TeX,HTML")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));

// PR-selection criteria
const SINCE = str(process.env.SINCE, "2024-01-01");                  // PR created since
const PER_REPO = num(process.env.PER_REPO, 5);                        // PRs considered per repo
const MIN_COMMENTS = num(process.env.MIN_COMMENTS, 12);              // min conversation comments
const MIN_REACTIONS = num(process.env.MIN_REACTIONS, 0);            // min reactions on the PR
const TOP_COMMENTS = num(process.env.TOP_COMMENTS, 6);              // comments kept per PR

const TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
const REPOS_OVERRIDE = (process.env.REPOS && process.env.REPOS.trim())
  ? process.env.REPOS.split(",").map((s) => s.trim()).filter(Boolean)
  : null;

// Curated repos with strong *engineering review cultures* — these are mined
// FIRST (before raw-star auto-discovery), because review value ≠ popularity.
// Star-ranked discovery alone surfaces curricula / awesome-lists / book repos
// whose PRs have little review prose; these don't. Disable with SEEDS=off.
const SEED_REPOS = (process.env.SEEDS === "off") ? [] : [
  "rust-lang/rust", "rust-lang/rfcs", "rust-lang/cargo", "nodejs/node",
  "microsoft/TypeScript", "denoland/deno", "vitejs/vite", "facebook/react",
  "vuejs/core", "sveltejs/svelte", "kubernetes/kubernetes", "kubernetes/enhancements",
  "bitcoin/bitcoin", "swiftlang/swift", "dotnet/runtime", "llvm/llvm-project",
  "JetBrains/kotlin", "ziglang/zig", "neovim/neovim", "zed-industries/zed",
  "godotengine/godot", "bevyengine/bevy", "WebKit/WebKit", "ollama/ollama",
  "huggingface/transformers", "pytorch/pytorch", "numpy/numpy", "scikit-learn/scikit-learn",
  "pola-rs/polars", "grafana/grafana", "prometheus/prometheus", "envoyproxy/envoy",
  "cockroachdb/cockroach", "elastic/elasticsearch", "django/django", "rails/rails",
  "symfony/symfony", "pydantic/pydantic", "apache/airflow", "eslint/eslint",
  "prettier/prettier", "microsoft/playwright", "remix-run/react-router", "angular/angular",
];

const DEADLINE = RUNTIME_MIN > 0 ? Date.now() + RUNTIME_MIN * 60_000 : Infinity;
const STARTED = Date.now();
const IS_TTY = !!(process.stdout && process.stdout.isTTY);

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
interface Reactions { total_count: number; "+1": number; "-1": number; laugh: number; hooray: number; confused: number; heart: number; rocket: number; eyes: number; }
interface Comment { user: { login: string }; body: string; html_url: string; created_at: string; reactions?: Reactions; }
interface PullMeta { title: string; html_url: string; user: { login: string }; merged: boolean; state: string; created_at: string; additions: number; deletions: number; changed_files: number; comments: number; review_comments: number; }
interface RepoRef { full_name: string; stars: number; forks: number; score: number; }
interface SearchItem { number: number; title: string; created_at: string; comments: number; reactions: number; }
interface ManifestEntry { repo: string; number: number; title: string; created_at: string; topReactions: number; repoStars: number; repoScore: number; file: string; collectedAt: string; }

// ────────────────────────────────────────────────────────────────────────────
// Small utilities
// ────────────────────────────────────────────────────────────────────────────
function num(v: string | undefined, d: number): number { const n = v ? parseInt(v, 10) : NaN; return Number.isFinite(n) ? n : d; }
// Treat empty strings (passed by Make for unset vars) as "use the default".
function str(v: string | undefined, d: string): string { return v && v.trim() ? v.trim() : d; }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString().slice(11, 19);
function log(msg: string) { if (IS_TTY) process.stdout.write("\r\x1b[K"); console.log(`[${now()}] ${msg}`); }
function timeLeft() { return DEADLINE === Infinity ? "∞" : `${Math.max(0, Math.round((DEADLINE - Date.now()) / 60_000))}m`; }
const BOT = /(\[bot\]|bot$|robot|codecov|netlify|rust-timer|rust-log|bors|github-actions|sizebot|changeset|vue-bot|k8s-ci-robot|dependabot)/i;
function slug(s: string) { return s.replace(/[^a-z0-9]+/gi, "-").toLowerCase(); }

// Composite "importance" score — popularity + collaboration + recency.
function importance(stars: number, forks: number, pushedAt: string): number {
  const ageDays = (Date.now() - Date.parse(pushedAt || "2000-01-01")) / 86_400_000;
  const recency = Math.max(0, 1 - ageDays / 365); // 1.0 if pushed today → 0 at 1y+
  return Math.round(stars + 4 * forks + recency * 5000);
}

// ────────────────────────────────────────────────────────────────────────────
// Progress bar (TTY) / periodic status (pipe)
// ────────────────────────────────────────────────────────────────────────────
let lastTick = 0;
function progress(collected: number, target: number, reposScanned: number, waiting = "") {
  const elapsedS = (Date.now() - STARTED) / 1000;
  const rate = collected > 0 ? collected / (elapsedS / 60) : 0; // PRs/min
  const etaTxt = target > 0 && rate > 0 ? ` · ETA ${Math.round((target - collected) / rate)}m` : "";
  if (IS_TTY) {
    const width = 26;
    const frac = target > 0 ? Math.min(1, collected / target) : 0;
    const filled = Math.round(frac * width);
    const bar = "█".repeat(filled) + "░".repeat(width - filled);
    const pct = target > 0 ? ` ${String(Math.round(frac * 100)).padStart(3)}%` : "";
    const tgt = target > 0 ? `/${target}` : "";
    process.stdout.write(`\r\x1b[K[${bar}]${pct}  ${collected}${tgt} PRs · ${reposScanned} repos · ${rate.toFixed(1)}/min${etaTxt} · ${timeLeft()} left${waiting ? " · " + waiting : ""}`);
  } else if (Date.now() - lastTick > 15_000) { // pipe/file: throttle to every 15s
    lastTick = Date.now();
    log(`progress: ${collected}${target ? `/${target}` : ""} PRs · ${reposScanned} repos · ${rate.toFixed(1)}/min${etaTxt}${waiting ? " · " + waiting : ""}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// The heart of the script: a fetch wrapper that WAITS OUT the rate limit.
// ────────────────────────────────────────────────────────────────────────────
async function ghFetch(url: string, attempt = 0): Promise<any | null> {
  if (Date.now() > DEADLINE) return null;
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "drift-pr-review-collector",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;

  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    if (attempt >= 6) { log(`network give-up: ${url}`); return null; }
    const wait = Math.min(60, 2 ** attempt) * 1000;
    log(`network error (${String(err).slice(0, 60)}), retry in ${wait / 1000}s`);
    await sleep(wait);
    return ghFetch(url, attempt + 1);
  }

  const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? "1");
  const reset = Number(res.headers.get("x-ratelimit-reset") ?? "0");

  if (res.status === 403 || res.status === 429 || remaining === 0) {
    const body = await res.text().catch(() => "");
    const isRate = res.status === 429 || /rate limit/i.test(body) || remaining === 0;
    if (isRate) {
      const waitMs = Math.max(2000, reset * 1000 - Date.now() + 2000);
      if (Date.now() + waitMs > DEADLINE) { log(`rate-limited; reset in ${Math.round(waitMs / 1000)}s is past the runtime budget — stopping`); return null; }
      const until = new Date(reset * 1000).toISOString().slice(11, 19);
      if (IS_TTY) process.stdout.write(`\r\x1b[K⏳ rate limit — sleeping ${Math.round(waitMs / 1000)}s (until ${until} UTC)…`);
      else log(`rate limit hit — sleeping ${Math.round(waitMs / 1000)}s until ${until} UTC… (${timeLeft()} left)`);
      await sleep(waitMs);
      return ghFetch(url, attempt); // rate-limit waits don't count as attempts
    }
    log(`403 (not rate-limit) on ${url}: ${body.slice(0, 80)}`);
    return null;
  }

  if (res.status === 404 || res.status === 422) return null;
  if (res.status >= 500) { if (attempt >= 5) return null; await sleep(5000); return ghFetch(url, attempt + 1); }
  if (!res.ok) { log(`HTTP ${res.status} on ${url}`); return null; }
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// Repo discovery — async generator that yields important repos *forever*,
// walking descending star buckets (down to MIN_STARS) with an importance gate.
// ────────────────────────────────────────────────────────────────────────────
async function* discoverRepos(): AsyncGenerator<RepoRef> {
  if (REPOS_OVERRIDE) { for (const f of REPOS_OVERRIDE) yield { full_name: f, stars: 0, forks: 0, score: 0 }; return; }

  const yielded = new Set<string>();
  // Mine curated review-culture repos first (highest signal-to-noise).
  for (const f of SEED_REPOS) { if (Date.now() > DEADLINE) return; yielded.add(f); yield { full_name: f, stars: 0, forks: 0, score: 0 }; }

  const langQ = REPO_LANG ? `+language:${encodeURIComponent(REPO_LANG)}` : "";
  let upper: number | null = null; // descending upper bound on stars

  while (Date.now() < DEADLINE) {
    const starQ = upper === null ? `stars:>=${MIN_STARS}` : `stars:${MIN_STARS}..${upper}`;
    let minSeen = Infinity;
    let yieldedThisWindow = 0;

    for (let page = 1; page <= 10; page++) { // GitHub search caps at 1000/query
      if (Date.now() > DEADLINE) return;
      const url = `https://api.github.com/search/repositories?q=${starQ}+pushed:>=${ACTIVE_SINCE}+archived:false${langQ}&sort=stars&order=desc&per_page=100&page=${page}`;
      const data = await ghFetch(url);
      const items: any[] = data?.items ?? [];
      if (!items.length) break;
      for (const r of items) {
        const stars = r.stargazers_count ?? 0;
        if (stars < minSeen) minSeen = stars;
        // ── importance gate ──────────────────────────────────────────────
        const lang = (r.language ?? "").toLowerCase();
        if (!lang || EXCLUDE_LANGS.has(lang)) continue;       // real code only
        if ((r.forks_count ?? 0) < MIN_FORKS) continue;        // collaborative only
        if (yielded.has(r.full_name)) continue;
        yielded.add(r.full_name);
        yieldedThisWindow++;
        yield { full_name: r.full_name, stars, forks: r.forks_count ?? 0, score: importance(stars, r.forks_count ?? 0, r.pushed_at) };
      }
      if (items.length < 100) break;
    }

    if (yieldedThisWindow === 0 && minSeen === Infinity) break; // nothing returned
    if (minSeen <= MIN_STARS) break;                            // reached the floor
    upper = minSeen;                                            // next window below (dedup via `yielded`)
  }
}

// ────────────────────────────────────────────────────────────────────────────
// PR discovery (per repo) — applies the PR-selection criteria.
// ────────────────────────────────────────────────────────────────────────────
async function discoverPRs(repo: string): Promise<SearchItem[]> {
  const q = encodeURIComponent(`repo:${repo} is:pr is:merged created:>=${SINCE}`);
  const url = `https://api.github.com/search/issues?q=${q}&sort=comments&order=desc&per_page=${PER_REPO}`;
  const data = await ghFetch(url);
  if (!data?.items) return [];
  return data.items
    .map((i: any): SearchItem => ({ number: i.number, title: i.title, created_at: i.created_at, comments: i.comments, reactions: i.reactions?.total_count ?? 0 }))
    .filter((i: SearchItem) => i.comments >= MIN_COMMENTS && i.reactions >= MIN_REACTIONS);
}

// ────────────────────────────────────────────────────────────────────────────
// Render one PR to Markdown.
// ────────────────────────────────────────────────────────────────────────────
function emoji(r: Reactions): string {
  const parts: string[] = [];
  const map: [keyof Reactions, string][] = [["+1", "👍"], ["heart", "❤️"], ["hooray", "🎉"], ["rocket", "🚀"], ["eyes", "👀"], ["laugh", "😄"], ["-1", "👎"], ["confused", "😕"]];
  for (const [k, e] of map) { const v = r[k] as number; if (v) parts.push(`${e} ${v}`); }
  return parts.join(" · ") || "—";
}
function clean(s: string): string {
  let t = s.replace(/<!--[\s\S]*?-->/g, "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (t.length > 1600) t = t.slice(0, 1600).trimEnd() + " … *[truncated]*";
  return t;
}
function fileFor(repo: string, n: number): string { return `${OUT_DIR}/auto-${slug(repo)}-${n}.md`; }

async function collectPR(repo: RepoRef, item: SearchItem): Promise<ManifestEntry | null> {
  const file = fileFor(repo.full_name, item.number);
  if (await Bun.file(file).exists()) return null; // resume

  const [owner, name] = repo.full_name.split("/");
  const pr: PullMeta | null = await ghFetch(`https://api.github.com/repos/${owner}/${name}/pulls/${item.number}`);
  if (!pr) return null;
  const comments: Comment[] | null = await ghFetch(`https://api.github.com/repos/${owner}/${name}/issues/${item.number}/comments?per_page=100`);
  if (!comments) return null;

  const ranked = comments
    .filter((c) => c.user && !BOT.test(c.user.login) && (c.body ?? "").trim().length >= 40)
    .sort((a, b) => (b.reactions?.total_count ?? 0) - (a.reactions?.total_count ?? 0))
    .slice(0, TOP_COMMENTS);

  const md: string[] = [];
  md.push(`# ${repo.full_name} #${item.number} — ${pr.title}\n`);
  md.push(`**[View PR on GitHub](${pr.html_url})**\n`);
  md.push("| | |", "|---|---|");
  md.push(`| **Author** | @${pr.user.login} |`);
  md.push(`| **Status** | ${pr.merged ? "✅ merged" : pr.state} |`);
  md.push(`| **Opened** | ${pr.created_at.slice(0, 10)} |`);
  md.push(repo.stars > 0
    ? `| **Repo importance** | ★${repo.stars.toLocaleString()} · ${repo.forks.toLocaleString()} forks · score ${repo.score.toLocaleString()} |`
    : `| **Repo** | curated review-culture seed |`);
  md.push(`| **Diff** | +${pr.additions} / −${pr.deletions} across ${pr.changed_files} files |`);
  md.push(`| **Engagement** | ${pr.comments} conversation · ${pr.review_comments} inline review comments |\n`);
  md.push(`## Top review comments (ranked by reactions)\n`);
  if (comments.length >= 100) md.push(`> ⚠️ Only the first 100 conversation comments were fetched (API page cap).\n`);
  if (!ranked.length) md.push(`*(No substantive human comment found.)*\n`);
  for (const c of ranked) {
    const r = c.reactions ?? ({ total_count: 0 } as Reactions);
    md.push(`### @${c.user.login} — ${r.total_count} reactions  \n\`${emoji(r)}\`  ·  [link](${c.html_url})\n`);
    md.push("> " + clean(c.body).replace(/\n/g, "\n> ") + "\n");
  }
  md.push(`\n---\n*Collected automatically by \`collect.ts\` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*\n`);

  await Bun.write(file, md.join("\n"));
  const top = ranked[0]?.reactions?.total_count ?? 0;
  log(`saved ${repo.full_name}#${item.number} (★${repo.stars} · top 💬 ${top}) — ${pr.title.slice(0, 44)}`);
  return { repo: repo.full_name, number: item.number, title: pr.title, created_at: pr.created_at, topReactions: top, repoStars: repo.stars, repoScore: repo.score, file: `prs/auto-${slug(repo.full_name)}-${item.number}.md`, collectedAt: new Date().toISOString() };
}

// ────────────────────────────────────────────────────────────────────────────
// Manifest + index
// ────────────────────────────────────────────────────────────────────────────
async function loadManifest(): Promise<ManifestEntry[]> { try { return JSON.parse(await Bun.file(MANIFEST).text()); } catch { return []; } }
async function writeIndex(entries: ManifestEntry[]) {
  const sorted = [...entries].sort((a, b) => b.topReactions - a.topReactions || (b.repoScore ?? 0) - (a.repoScore ?? 0));
  const L: string[] = [];
  L.push(`# Auto-Collected PR Reviews\n`);
  L.push(`> Generated by [\`collect.ts\`](collect.ts) — **${entries.length}** merged PRs (since ${SINCE}) across ${new Set(entries.map((e) => e.repo)).size} repositories, collected with no GitHub token, ranked by the reactions on their most-liked review comment.\n`);
  L.push(`| Repo | ★ | PR | Title | Top 💬 |`, `|------|--:|----|-------|-------:|`);
  for (const e of sorted) {
    const t = e.title.length > 48 ? e.title.slice(0, 47) + "…" : e.title;
    L.push(`| ${e.repo} | ${(e.repoStars ?? 0).toLocaleString()} | [#${e.number}](${e.file}) | ${t} | ${e.topReactions} |`);
  }
  L.push("");
  await Bun.write(INDEX_MD, L.join("\n"));
}

// ────────────────────────────────────────────────────────────────────────────
// Main — stream repos → PRs → collect, until target/budget.
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  const target = MAX_PRS > 0 ? `${MAX_PRS} PRs` : "unlimited";
  const budget = RUNTIME_MIN > 0 ? `${RUNTIME_MIN}m` : "no time cap";
  const repoCap = MAX_REPOS > 0 ? `≤${MAX_REPOS} repos` : "∞ repos";
  log(`collect.ts — target=${target}, runtime=${budget}, ${repoCap}, discovery=${REPOS_OVERRIDE ? `${REPOS_OVERRIDE.length} explicit` : `auto (★≥${MIN_STARS}, forks≥${MIN_FORKS}${REPO_LANG ? `, ${REPO_LANG}` : ""})`}, ${TOKEN ? "TOKEN set" : "NO token (60/hr)"}.`);
  await Bun.write(`${OUT_DIR}/.keep`, "");

  const manifest = await loadManifest();
  const seen = new Set(manifest.map((m) => `${m.repo}#${m.number}`));
  let collected = 0, reposScanned = 0;

  for await (const repo of discoverRepos()) {
    if (Date.now() > DEADLINE) { log(`runtime budget reached.`); break; }
    if (MAX_PRS > 0 && collected >= MAX_PRS) { log(`target ${MAX_PRS} reached.`); break; }
    if (MAX_REPOS > 0 && reposScanned >= MAX_REPOS) { log(`repo cap ${MAX_REPOS} reached.`); break; }
    reposScanned++;
    progress(collected, MAX_PRS, reposScanned, `scanning ${repo.full_name}`);

    const prs = await discoverPRs(repo.full_name);
    for (const item of prs) {
      if (Date.now() > DEADLINE) break;
      if (MAX_PRS > 0 && collected >= MAX_PRS) break;
      if (seen.has(`${repo.full_name}#${item.number}`)) continue;
      const entry = await collectPR(repo, item);
      if (entry) {
        manifest.push(entry);
        seen.add(`${repo.full_name}#${item.number}`);
        collected++;
        progress(collected, MAX_PRS, reposScanned);
        if (collected % 3 === 0) { await Bun.write(MANIFEST, JSON.stringify(manifest, null, 2)); await writeIndex(manifest); }
      }
    }
  }

  if (IS_TTY) process.stdout.write("\n");
  await Bun.write(MANIFEST, JSON.stringify(manifest, null, 2));
  await writeIndex(manifest);
  log(`DONE — collected ${collected} new PRs this run (scanned ${reposScanned} repos); ${manifest.length} total in manifest. Index → COLLECTED.md`);
}

main().catch((e) => { console.error(e); process.exit(1); });
