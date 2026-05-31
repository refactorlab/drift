// Change cohorts — group a PR's changed files into a handful of semantic
// "areas" so a 40-file diff collapses into ~5 scannable rows (Qodo `/describe`
// walkthrough · CodeRabbit "Changes" table). This is the skim-map a big PR
// otherwise lacks, and it doubles as a clickable table of contents into the
// diff.
//
// CLEAN-ARCHITECTURE NOTE: grouping is by FILE ROLE + PATH only (tests / docs /
// config / source-area), never by programming language. Path-role heuristics
// are language-neutral, so this stays out of the per-language profile world —
// no `if (lang === 'rust')` ever belongs here.
//
// Pure function of the changed-file list (+ the unreachable set), so it
// unit-tests trivially and can never disagree with the architecture/blast-radius
// sections that read the same scope.

/** A semantic group of changed files. */
export type Cohort = {
  /** Stable grouping key (also the sort tiebreaker). */
  key: string;
  /** Human label shown in the walkthrough table. */
  label: string;
  /** Role bucket — drives ordering (source first, tests/docs/config after). */
  role: 'source' | 'tests' | 'docs' | 'config';
  /** Full paths in this cohort (original order preserved). */
  files: string[];
  /** How many of this cohort's files are unreachable from any entry point. */
  unreachable: number;
};

export type CohortSummary = {
  cohorts: Cohort[];
  totalFiles: number;
  /**
   * Spread verdict from the count of SOURCE areas (tests/docs/config don't
   * count toward "is this PR doing too many things"):
   *   focused — one source area (or trivially small)
   *   multi   — 2–3 source areas
   *   spread  — 4+ source areas (a reviewer may prefer this split up)
   */
  spread: 'focused' | 'multi' | 'spread';
  /** Number of distinct SOURCE areas (the spread denominator). */
  sourceAreas: number;
};

// Role detection — path-only, language-agnostic. Order matters: a file under
// `__tests__` that also ends in `.md` is still a test.
const TEST_RE = /(^|\/)(tests?|__tests__|spec|specs|e2e|fixtures?)(\/|$)|\.(test|spec)\.[a-z0-9]+$|_test\.[a-z0-9]+$/i;
// The keyword branch is anchored to a whole final segment (optionally + ext) so
// a SOURCE file like `src/licenseManager.ts` or `lib/readme_parser.ts` is NOT
// misread as docs (which would corrupt the source-area count + focused verdict).
const DOCS_RE = /(^|\/)docs?(\/|$)|\.(md|mdx|rst|adoc|txt)$|(^|\/)(readme|license|changelog|contributing)(\.[a-z0-9]+)?$/i;
const CONFIG_RE =
  /\.(ya?ml|json|toml|ini|cfg|conf|lock|env)$|(^|\/)\.[^/]+$|(^|\/)(dockerfile|makefile|\.github|\.config)(\/|$)|\.(gitignore|editorconfig|npmrc|prettierrc|eslintrc)/i;

/**
 * Group changed files into cohorts. `unreachable` is the set of paths the call
 * graph couldn't reach from any entry point (likely dead code / config / tests)
 * — used only to annotate each cohort with a count, never to drop files.
 */
export function groupCohorts(changedFiles: string[], unreachable: string[] = []): CohortSummary {
  const dead = new Set(unreachable);
  const byKey = new Map<string, Cohort>();

  for (const file of changedFiles) {
    const { key, label, role } = classify(file);
    let c = byKey.get(key);
    if (!c) {
      c = { key, label, role, files: [], unreachable: 0 };
      byKey.set(key, c);
    }
    c.files.push(file);
    if (dead.has(file)) c.unreachable += 1;
  }

  // Order: source areas first (largest first — the reviewer's main story),
  // then tests, docs, config; ties broken by key for determinism.
  const ROLE_RANK: Record<Cohort['role'], number> = { source: 0, tests: 1, docs: 2, config: 3 };
  const cohorts = [...byKey.values()].sort(
    (a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || b.files.length - a.files.length || a.key.localeCompare(b.key),
  );

  const sourceAreas = cohorts.filter((c) => c.role === 'source').length;
  const spread: CohortSummary['spread'] = sourceAreas >= 4 ? 'spread' : sourceAreas >= 2 ? 'multi' : 'focused';

  return { cohorts, totalFiles: changedFiles.length, spread, sourceAreas };
}

/** Map one path to its (key, label, role). */
function classify(file: string): { key: string; label: string; role: Cohort['role'] } {
  const path = file.replace(/^\.\//, '');

  if (TEST_RE.test(path)) return { key: 'role:tests', label: 'Tests', role: 'tests' };
  if (DOCS_RE.test(path)) return { key: 'role:docs', label: 'Docs', role: 'docs' };
  if (CONFIG_RE.test(path)) return { key: 'role:config', label: 'Config & CI', role: 'config' };

  // Source: bucket by a meaningful directory. Use the first TWO path segments
  // when there are ≥3 (e.g. `src/render/foo.ts` → `src/render`), else the
  // dirname, else "(root)". Gives areas like `src/render`, `action/scripts`.
  const segs = path.split('/').filter(Boolean);
  if (segs.length <= 1) return { key: 'dir:(root)', label: '(repo root)', role: 'source' };
  const depth = segs.length >= 3 ? 2 : segs.length - 1;
  const dir = segs.slice(0, depth).join('/');
  return { key: `dir:${dir}`, label: dir, role: 'source' };
}
