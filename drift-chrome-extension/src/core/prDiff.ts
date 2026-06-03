// Get the PR's head commit + changed files from GitHub's STABLE git-plumbing
// endpoints — `github.com/{o}/{r}/pull/{n}.patch` and `.diff`. These are
// same-origin github.com (so the session cookie authenticates PRIVATE repos),
// NOT the REST API, and NOT React markup that shifts between releases. This
// replaces the fragile PR-page ref scrape AND the two-zip local diff:
//   • `.patch` → the head commit SHA (last `From <sha>` line) — download the
//     HEAD tree by sha, no branch-name scraping needed.
//   • `.diff`  → the changed files + line counts directly — no base zip, no
//     local tree diff (and half the download for big monorepos).
// The scanner never needed the base tree; the two zips only existed to compute
// the changed-file set, which `.diff` gives us for free.

export type PrHead = { headSha: string; title?: string };

/** One changed file with its status — the structured form the UI renders as a
 *  badge list (the literal "what changed" view). */
export type ChangedFileStatus = {
  code: 'A' | 'M' | 'D' | 'R' | 'C' | 'T';
  /** Path at HEAD (the new path for renames/copies). */
  path: string;
  /** Pre-PR path, set only for renames/copies. */
  oldPath?: string;
  additions: number;
  deletions: number;
};

export type DiffResult = {
  /** Paths present at HEAD (git `--diff-filter=ACMRT`) — the set the scanner walks. */
  changedPaths: string[];
  /** `adds\tdels\tpath` numstat lines (git `--numstat` shape). */
  diffStats: string;
  /** `git diff --name-status` shape: `A/M/D/T\tpath`, `R<sim>/C<sim>\told\tnew`.
   *  Reconstructed git-free from the unified diff's extended headers — see
   *  `parseUnifiedDiff`. Feeds the scanner's `--diff-status` (BEFORE/AFTER charts
   *  + removed-card rendering). */
  diffStatus: string;
  /** The same status data structured for the UI's Changed-files list. */
  entries: ChangedFileStatus[];
};

// ── .patch → head sha ───────────────────────────────────────────────────────

/** Parse `git format-patch` output: commits run oldest→newest, so the LAST
 *  `From <sha>` is the PR head. Subject (minus the [PATCH n/m] prefix) is a
 *  decent title when the page title isn't available. */
export function parsePatchHead(patch: string): PrHead {
  const shas = [...patch.matchAll(/^From ([0-9a-f]{40}) /gm)].map((m) => m[1]);
  if (!shas.length) throw new Error('no commits found in the PR patch');
  // Subjects run one per commit; the LAST aligns with the head commit (last `From`).
  const subjects = [...patch.matchAll(/^Subject:\s*(?:\[PATCH[^\]]*\]\s*)?(.+)$/gm)].map((m) => m[1].trim());
  return { headSha: shas[shas.length - 1], title: subjects.at(-1) || undefined };
}

/**
 * GitHub 302-redirects `…/pull/N.(diff|patch)` → `…/issues/N` (HTTP 200, an
 * HTML page) when N is an ISSUE, not a PR — and serves an HTML sign-in/“diff too
 * large” page in some other cases too. `res.ok` doesn't catch any of these, so a
 * naive parse silently yields an EMPTY changed-file set and the scan runs on
 * nothing. Guard explicitly: a non-PR final URL or an HTML content-type means
 * there is no patch/diff to parse. (Found probing real PRs — issue numbers
 * return 200 + HTML.)
 */
function assertPrDocument(res: Response, owner: string, repo: string, number: number): void {
  if (/\/issues\/\d+/.test(res.url)) {
    throw new Error(`${owner}/${repo}#${number} is an issue, not a pull request`);
  }
  if ((res.headers.get('content-type') ?? '').includes('text/html')) {
    throw new Error(
      `GitHub returned an HTML page, not a diff, for ${owner}/${repo}#${number} ` +
        `— not a pull request, or you're not signed in for a private repo`,
    );
  }
}

export async function fetchPrHead(
  owner: string,
  repo: string,
  number: number,
  signal?: AbortSignal,
): Promise<PrHead> {
  const url = `https://github.com/${owner}/${repo}/pull/${number}.patch`;
  const res = await fetch(url, { credentials: 'include', redirect: 'follow', signal });
  if (!res.ok) {
    throw new Error(`couldn't read the PR patch (HTTP ${res.status}) — are you signed in to GitHub?`);
  }
  assertPrDocument(res, owner, repo, number);
  return parsePatchHead(await res.text());
}

// ── .diff → changed files + numstat ─────────────────────────────────────────

/** One file's worth of state accumulated while walking a unified diff. */
type DiffEntry = {
  /** Path at HEAD (the `b/` side; rewritten by `rename to`/`copy to`). */
  newPath: string;
  /** Path before the PR (the `a/` side; rewritten by `rename from`/`copy from`). */
  oldPath: string;
  status: 'A' | 'M' | 'D' | 'R' | 'C' | 'T';
  adds: number;
  dels: number;
  /** Rename/copy similarity score (`similarity index N%`), when present. */
  sim?: number;
};

/**
 * Parse a unified diff into the three sidecar inputs the scanner consumes —
 * git-free, straight from the diff text GitHub generated server-side. There is
 * NO `.git` in the downloaded archive, so this is the only honest source of the
 * diff in a no-API, no-git environment.
 *
 *   • `changedPaths` — files present at HEAD (git `--diff-filter=ACMRT`). We
 *     EXCLUDE deletes: a `D` file isn't in the HEAD tree, so the walker can't
 *     scan it (matches the action's `--name-only --diff-filter=ACMRT`).
 *   • `diffStats`    — `adds\tdels\tpath` numstat lines (incl. deletes, whose
 *     dels feed the removed-card LOC).
 *   • `diffStatus`   — `git diff --name-status` shape: `A/M/D/T\tpath`,
 *     `R<sim>/C<sim>\told\tnew`. Deletes ARE included here so the BEFORE chart
 *     can render the red removed-card row.
 *
 * Status comes from the diff's EXTENDED HEADERS (`new file mode`,
 * `deleted file mode`, `rename from/to`, `copy from/to`, `similarity index`),
 * which the old parser threw away. Caveat: GitHub's raw `.diff` does NOT apply
 * `-M` rename detection, so a rename usually arrives as a `D old` + `A new`
 * pair rather than an `R` line — identical to `git diff` without `--find-renames`,
 * and still correct (just less compact). When GitHub DOES emit rename headers we
 * honor them.
 */
export function parseUnifiedDiff(diff: string): DiffResult {
  const files: DiffEntry[] = [];
  let cur: DiffEntry | null = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      // `diff --git a/<old> b/<new>` — same path on both sides for plain
      // edits/adds/deletes; differing for renames/copies. /dev/null never
      // appears here (it's only in the ---/+++ hunk headers we skip).
      const m = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      cur = m ? { oldPath: m[1], newPath: m[2], status: 'M', adds: 0, dels: 0 } : null;
      if (cur) files.push(cur);
      continue;
    }
    if (!cur) continue;
    if (line.startsWith('new file mode')) cur.status = 'A';
    else if (line.startsWith('deleted file mode')) cur.status = 'D';
    else if (line.startsWith('rename from ')) { cur.oldPath = line.slice(12); cur.status = 'R'; }
    else if (line.startsWith('rename to ')) { cur.newPath = line.slice(10); cur.status = 'R'; }
    else if (line.startsWith('copy from ')) { cur.oldPath = line.slice(10); cur.status = 'C'; }
    else if (line.startsWith('copy to ')) { cur.newPath = line.slice(8); cur.status = 'C'; }
    else if (line.startsWith('similarity index ')) {
      const n = parseInt(line.slice(17), 10);
      if (!Number.isNaN(n)) cur.sim = n;
    } else if (
      line.startsWith('+++') ||
      line.startsWith('---') ||
      line.startsWith('@@') ||
      line.startsWith('index ') ||
      line.startsWith('old mode') ||
      line.startsWith('new mode') ||
      line.startsWith('dissimilarity index') ||
      line.startsWith('Binary ') ||
      line.startsWith('GIT binary patch') ||
      line.startsWith('\\ No newline')
    ) {
      continue;
    } else if (line[0] === '+') {
      cur.adds++;
    } else if (line[0] === '-') {
      cur.dels++;
    }
  }

  const valid = files.filter((e) => e.newPath && e.oldPath);
  // numstat keys on the HEAD path (deletes keep their path so removed cards get LOC).
  const diffStats = valid.map((e) => `${e.adds}\t${e.dels}\t${e.newPath}`).join('\n');
  // changed-files: everything present at HEAD — i.e. NOT deleted.
  const changedPaths = valid.filter((e) => e.status !== 'D').map((e) => e.newPath);
  const diffStatus = valid.map(statusLine).join('\n');
  const entries: ChangedFileStatus[] = valid.map((e) => ({
    code: e.status,
    path: e.newPath,
    oldPath: e.status === 'R' || e.status === 'C' ? e.oldPath : undefined,
    additions: e.adds,
    deletions: e.dels,
  }));
  return { changedPaths, diffStats, diffStatus, entries };
}

/** One `git diff --name-status` line for an entry. Renames/copies carry the
 *  similarity score + old→new pair; everything else is `<code>\t<path>`. */
function statusLine(e: DiffEntry): string {
  if (e.status === 'R' || e.status === 'C') {
    return `${e.status}${e.sim ?? ''}\t${e.oldPath}\t${e.newPath}`;
  }
  return `${e.status}\t${e.newPath}`;
}

export async function fetchPrChangedFiles(
  owner: string,
  repo: string,
  number: number,
  signal?: AbortSignal,
): Promise<DiffResult> {
  const url = `https://github.com/${owner}/${repo}/pull/${number}.diff`;
  const res = await fetch(url, { credentials: 'include', redirect: 'follow', signal });
  if (!res.ok) throw new Error(`couldn't read the PR diff (HTTP ${res.status})`);
  assertPrDocument(res, owner, repo, number);
  return parseUnifiedDiff(await res.text());
}
