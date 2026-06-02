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
export type DiffResult = { changedPaths: string[]; diffStats: string };

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
  return parsePatchHead(await res.text());
}

// ── .diff → changed files + numstat ─────────────────────────────────────────

/** Parse a unified diff into changed paths + `adds\tdels\tpath` numstat lines.
 *  Path comes from the `diff --git a/… b/PATH` header (set even for deletes);
 *  +/- counts come from the hunk body, skipping the ±±±/@@/index/mode headers. */
export function parseUnifiedDiff(diff: string): DiffResult {
  const files = new Map<string, { adds: number; dels: number }>();
  let cur: { adds: number; dels: number } | null = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const m = line.match(/ b\/(.+)$/);
      if (m) {
        cur = { adds: 0, dels: 0 };
        files.set(m[1], cur);
      } else {
        cur = null;
      }
    } else if (!cur) {
      continue;
    } else if (
      line.startsWith('+++') ||
      line.startsWith('---') ||
      line.startsWith('@@') ||
      line.startsWith('index ') ||
      line.startsWith('new file') ||
      line.startsWith('deleted file') ||
      line.startsWith('rename ') ||
      line.startsWith('similarity ') ||
      line.startsWith('copy ') ||
      line.startsWith('old mode') ||
      line.startsWith('new mode') ||
      line.startsWith('Binary ')
    ) {
      continue;
    } else if (line[0] === '+') {
      cur.adds++;
    } else if (line[0] === '-') {
      cur.dels++;
    }
  }
  const entries = [...files.entries()].filter(([p]) => p && p !== '/dev/null');
  return {
    changedPaths: entries.map(([p]) => p),
    diffStats: entries.map(([p, s]) => `${s.adds}\t${s.dels}\t${p}`).join('\n'),
  };
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
  return parseUnifiedDiff(await res.text());
}
