// Fuzz / property-based tests.
//
// Hand-written tests guard the SHAPES we know to break. Fuzz tests
// guard the shapes we DIDN'T think of. We generate random scanner
// reports + envelope inputs and assert two universal invariants:
//
//   • The action never CRASHES. Fail-soft is in the action.yml
//     contract — every code path either succeeds, returns no-op, or
//     throws a tracked Error that the bundle handler converts to a
//     ::warning::. An uncaught exception or process exit ≠ 0 would
//     leave the consumer's PR in limbo (no review + no diagnostic).
//
//   • Filter outputs are INVARIANTS:
//      - `pickFocalSuggestions(report, max, …).length ≤ max`
//      - `filterByDiff(...).kept ∪ .dropped == input` (no losses, no dups)
//      - `kept` items pass the line-on-diff predicate
//      - `dropped` items have a reason in `reasons[idx]`
//
// 200 iterations per property — small enough to keep CI fast (~ 1s),
// large enough to surface most off-by-ones the hand-written tests miss.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickFocalSuggestions,
  commentableLinesByFile,
} from '../ai/build-context.ts';
import { filterByDiff } from '../ai/diff-lines.ts';
import type { ScanPrOutput, CodeSuggestion } from '../report.ts';
import type { AISuggestion } from '../ai/schema.ts';

// ─── PRNG with a fixed seed so failures reproduce ──────────────────────

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function randomFile(rng: () => number): string {
  // Mix of normal, nested, deep, and "monorepo crate" shaped paths so
  // the suffix-match bridge gets exercised on realistic inputs.
  const shape = rng();
  const base = pick(rng, ['a', 'foo', 'utils', 'service', 'repos', 'main']);
  const ext = pick(rng, ['.py', '.ts', '.go', '.rs', '.kt', '.java', '.js']);
  if (shape < 0.25) return `${base}${ext}`;
  if (shape < 0.5) return `src/${base}${ext}`;
  if (shape < 0.75) return `pkg/sub/${base}${ext}`;
  return `monorepo/services/crate-x/src/${base}${ext}`;
}

function randomCategory(rng: () => number): 'A' | 'B' | 'C' {
  return pick(rng, ['A', 'B', 'C'] as const);
}

function randomConfidence(rng: () => number): number {
  // Mix of below / at / above the 0.75 quality bar so we cover both
  // sides of the filter without bias.
  return Math.max(0, Math.min(1, rng()));
}

/**
 * Build a syntactically valid CodeSuggestion (matches the TS type).
 * Lines and file paths are still random — the filter has to handle
 * any combo without crashing.
 */
function randomFinding(rng: () => number): CodeSuggestion {
  const line = Math.floor(rng() * 200) + 1;
  return {
    category: randomCategory(rng),
    file: randomFile(rng),
    line,
    confidence: randomConfidence(rng),
    why_it_matters: 'fuzz-generated finding — load-bearing why_it_matters',
    references: [{ url: `https://example.com/r/${Math.floor(rng() * 1000)}` }],
    diff: { before_lines: [{ line_number: line, code: 'def f():', kind: 'del' }] },
  } as unknown as CodeSuggestion;
}

function randomReport(rng: () => number, n: number): ScanPrOutput {
  return {
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: {
      changed_files: Array.from({ length: 3 }, (_, i) => `f${i}.py`),
      affected_roots: [],
      unreachable_changes: [],
    },
    pr_review: {
      code_suggestions: Array.from({ length: n }, () => randomFinding(rng)),
    },
  } as unknown as ScanPrOutput;
}

function randomCommentable(
  rng: () => number,
  files: string[],
): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  // pick a random subset of files to include in the diff
  for (const f of files) {
    if (rng() < 0.5) continue;
    const set = new Set<number>();
    const cnt = 1 + Math.floor(rng() * 5);
    for (let i = 0; i < cnt; i += 1) set.add(1 + Math.floor(rng() * 200));
    map.set(f, set);
  }
  return map;
}

function randomSuggestion(rng: () => number): AISuggestion {
  const line = Math.floor(rng() * 200) + 1;
  const hasRange = rng() < 0.2;
  return {
    file: randomFile(rng),
    line,
    ...(hasRange ? { start_line: Math.max(1, line - Math.floor(rng() * 3)) } : {}),
    category: randomCategory(rng),
    confidence: randomConfidence(rng),
    why_it_matters: 'fuzz suggestion ≥ 10 chars',
    references: [{ url: `https://example.com/x/${Math.floor(rng() * 1000)}` }],
    after_code: 'fixed',
  };
}

// ─── pickFocalSuggestions: never crash, respect the cap ────────────────

test('fuzz (200 iters): pickFocalSuggestions respects cap + never crashes on random reports', () => {
  const rng = mulberry32(0xfeedbeef);
  for (let i = 0; i < 200; i += 1) {
    const n = Math.floor(rng() * 20); // 0..19 findings
    const report = randomReport(rng, n);
    const cap = Math.floor(rng() * 10);

    // Should never throw.
    const noCommentable = pickFocalSuggestions(report, cap);
    assert.ok(Array.isArray(noCommentable), 'must always return an array');
    assert.ok(noCommentable.length <= cap, `iter ${i}: len ${noCommentable.length} > cap ${cap}`);

    // With a commentable map.
    const allFiles = (report.pr_review?.code_suggestions ?? []).map((s) => s.file);
    const commentable = randomCommentable(rng, allFiles);
    const filtered = pickFocalSuggestions(report, cap, commentable);
    assert.ok(filtered.length <= cap, `iter ${i}: filtered len ${filtered.length} > cap ${cap}`);
    // Every kept finding's file must resolve through the commentable
    // map (either exact or suffix). Confirms the file-level filter
    // semantics never let an OFF-diff file leak through.
    for (const s of filtered) {
      const direct = commentable.get(s.file);
      const suffix = direct ?? Array.from(commentable.keys()).find(
        (k) => s.file.endsWith(k) || k.endsWith(s.file),
      );
      assert.ok(suffix !== undefined, `iter ${i}: kept finding ${s.file} not resolvable on diff`);
    }
  }
});

test('fuzz (200 iters): pickFocalSuggestions order is confidence-descending (sort invariant)', () => {
  const rng = mulberry32(0xdeadbeef);
  for (let i = 0; i < 200; i += 1) {
    const report = randomReport(rng, 10);
    const out = pickFocalSuggestions(report, 100);
    for (let j = 1; j < out.length; j += 1) {
      const prev = out[j - 1].confidence ?? 0;
      const cur = out[j].confidence ?? 0;
      assert.ok(prev >= cur, `iter ${i}: order broke at ${j}: ${prev} < ${cur}`);
    }
  }
});

// ─── filterByDiff: dropped items conserve, no duplicates ──────────────

test('fuzz (200 iters): filterByDiff conserves input (kept ∪ dropped == input, no dups)', () => {
  const rng = mulberry32(0xcafefeed);
  for (let i = 0; i < 200; i += 1) {
    const n = Math.floor(rng() * 10);
    const sugs: AISuggestion[] = Array.from({ length: n }, () => randomSuggestion(rng));
    const files = sugs.map((s) => s.file);
    const commentable = randomCommentable(rng, files);
    const { kept, dropped, reasons } = filterByDiff(sugs, commentable);
    // Conservation: every input ends up in exactly one of the buckets.
    assert.equal(kept.length + dropped.length, sugs.length, `iter ${i}: conservation broke`);
    // No dups within or across buckets — every input lands once.
    const seen = new Set<AISuggestion>();
    for (const s of [...kept, ...dropped]) {
      assert.ok(!seen.has(s), `iter ${i}: duplicate in kept+dropped`);
      seen.add(s);
    }
    // Every dropped item has a reason.
    assert.equal(reasons.length, dropped.length, `iter ${i}: reasons length mismatch`);
    for (const r of reasons) assert.equal(typeof r, 'string');
  }
});

test('fuzz (200 iters): every kept item has ALL its range lines commentable', () => {
  const rng = mulberry32(0x1337c0de);
  for (let i = 0; i < 200; i += 1) {
    const n = Math.floor(rng() * 10);
    const sugs: AISuggestion[] = Array.from({ length: n }, () => randomSuggestion(rng));
    const files = sugs.map((s) => s.file);
    const commentable = randomCommentable(rng, files);
    const { kept } = filterByDiff(sugs, commentable);
    for (const s of kept) {
      const start = s.start_line ?? s.line;
      // The set MUST be findable (exact or suffix).
      const set = commentable.get(s.file) ?? Array.from(commentable.entries()).find(
        ([k]) => s.file.endsWith(k) || k.endsWith(s.file),
      )?.[1];
      assert.ok(set, `iter ${i}: kept ${s.file}:${s.line} has no resolvable file`);
      for (let l = start; l <= s.line; l += 1) {
        assert.ok(set!.has(l), `iter ${i}: kept ${s.file} missing line ${l}`);
      }
    }
  }
});

// ─── commentableLinesByFile: never crash on malformed diff text ────────

test('fuzz (200 iters): commentableLinesByFile returns a Map on any string input', () => {
  // We pipe arbitrary strings at the parser — empty, malformed,
  // partial, junk — and assert it ALWAYS returns a Map (the
  // documented fail-safe). A crash here would take down ai-suggest.js.
  const rng = mulberry32(0x9badf00d);
  const samples = [
    '',
    '\n',
    'not a diff',
    '@@ -1 +1 @@',
    '@@ -1,1 +1,1 @@\n',
    '@@ -1,5 +1,3 @@\n+only',         // hunk lengths mismatch
    'diff --git a/x b/x\n@@ malformed',
  ];
  for (const s of samples) {
    const map = commentableLinesByFile(s);
    assert.ok(map instanceof Map, `must return Map, got ${typeof map}`);
  }
  // Random byte sequences.
  for (let i = 0; i < 200; i += 1) {
    const len = Math.floor(rng() * 500);
    const bytes = Array.from({ length: len }, () => Math.floor(rng() * 128));
    const s = String.fromCharCode(...bytes);
    const map = commentableLinesByFile(s);
    assert.ok(map instanceof Map);
  }
});
