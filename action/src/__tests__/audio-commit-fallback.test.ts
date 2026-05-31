// audio-commit-fallback: drives the FULL bash of action.yml's "Generate
// spoken PR briefing (commit-based fallback)" step (8d-fb) end-to-end against
// synthetic diff artifacts, asserting the run-time behavior — NOT just a
// YAML string-match.
//
// This is the fallback that keeps the 🔊 audio link alive when GitHub Models
// is throttled/unreachable: when the AI briefing (step 8d-pre) produced no
// file, this step composes a deterministic, spoken-style briefing from the
// PR's COMMIT MESSAGES + changed-file churn and writes it to
// FALLBACK_BRIEFING_PATH, which the synth step (8d) then speaks through the
// same Piper sanitiser/cap/guards.
//
// We feed the step the same artifact shapes step 6b writes:
//   COMMITS_PATH — `git log --format=%B%x00` → NUL-separated commit BODIES
//                  (subject + blank + body); the subject is the first line.
//   STATS_PATH   — `git diff --numstat` → `adds<TAB>dels<TAB>path` (binary
//                  rows report `-`).
// and assert the produced briefing is grounded in them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');

type StepSpec = { name?: string; id?: string; run?: string; if?: string; env?: Record<string, string> };
type ActionDoc = { runs: { steps: StepSpec[] } };

function fallbackStep(): StepSpec {
  const doc = parseYaml(readFileSync(join(REPO, 'action.yml'), 'utf8')) as ActionDoc;
  const step = doc.runs.steps.find((s) => s.id === 'briefing-fallback');
  assert.ok(step?.run, 'expected the "briefing-fallback" step to exist with a run: block');
  return step!;
}

// Each commit BODY = subject + (optional) blank line + body, NUL-terminated —
// exactly what `git log --format=%B%x00` writes to COMMITS_PATH.
function commitsFile(commits: Array<{ subject: string; body?: string }>): string {
  return commits
    .map((c) => (c.body ? `${c.subject}\n\n${c.body}` : c.subject) + '\0')
    .join('');
}

type Harness = {
  dir: string;
  fallbackPath: string;
  env: Record<string, string>;
};

function buildHarness(opts: {
  commits?: Array<{ subject: string; body?: string }>;
  // numstat rows: [adds, dels, path]; use '-' for binary.
  stats?: Array<[string | number, string | number, string]>;
  briefing?: string; // existing AI briefing content; default '' (absent)
  title?: string;
  writeCommitsFile?: boolean; // default true
  writeStatsFile?: boolean; // default true
} = {}): Harness {
  const dir = mkdtempSync(join(tmpdir(), 'drift-commit-fb-'));
  const commitsPath = join(dir, 'commits.txt');
  const statsPath = join(dir, 'stats.txt');
  const briefingPath = join(dir, 'briefing.txt');
  const fallbackPath = join(dir, 'fallback.txt');

  if (opts.writeCommitsFile !== false) {
    writeFileSync(commitsPath, commitsFile(opts.commits ?? [{ subject: 'feat: do a thing' }]));
  }
  if (opts.writeStatsFile !== false) {
    const rows = opts.stats ?? [[10, 2, 'src/a.ts']];
    writeFileSync(statsPath, rows.map((r) => `${r[0]}\t${r[1]}\t${r[2]}`).join('\n') + '\n');
  }
  writeFileSync(briefingPath, opts.briefing ?? '');

  return {
    dir,
    fallbackPath,
    env: {
      PATH: process.env.PATH ?? '',
      LC_ALL: 'C',
      BRIEFING_PATH: briefingPath,
      FALLBACK_BRIEFING_PATH: fallbackPath,
      COMMITS_PATH: commitsPath,
      STATS_PATH: statsPath,
      PR_TITLE: opts.title ?? 'Test PR title',
    },
  };
}

function runStep(h: Harness): { status: number; stdout: string; stderr: string; briefing: string } {
  const scriptPath = join(h.dir, 'fallback-step.sh');
  // GitHub Actions wraps composite `shell: bash` runs with `set -eo pipefail`
  // (note: NOT -u). Mirror that exactly so behaviour is faithful.
  const script = ['#!/usr/bin/env bash', 'set -eo pipefail', fallbackStep().run as string].join('\n');
  writeFileSync(scriptPath, script);
  const r = spawnSync('bash', [scriptPath], { env: h.env, encoding: 'utf8', timeout: 15000 });
  const briefing = existsSync(h.fallbackPath) ? readFileSync(h.fallbackPath, 'utf8') : '';
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '', briefing };
}

// ───────────────────── behavioral tests ─────────────────────

test('happy path: composes a spoken briefing grounded in commits + churn', () => {
  const h = buildHarness({
    title: 'Add audio fallback',
    commits: [
      { subject: 'feat(render): add audio fallback', body: 'This body line MUST be ignored.' },
      { subject: 'fix(action): harden Piper pipeline' },
      { subject: 'docs: update the README' },
    ],
    stats: [
      [120, 8, 'action/src/render/footer.ts'],
      [45, 3, 'action.yml'],
      ['-', '-', 'assets/logo.png'], // binary → skipped from totals
      [12, 0, 'README.md'],
    ],
  });
  const r = runStep(h);
  assert.equal(r.status, 0, `step failed: ${r.stderr}`);

  // Lead-in + title.
  assert.match(r.briefing, /^This is a commit based summary of this pull request\./);
  assert.match(r.briefing, /It is titled: Add audio fallback\./);
  // Scale: 3 commits, 4 files, churn EXCLUDES the binary row (120+45+12=177 add, 8+3+0=11 del).
  assert.match(r.briefing, /It contains 3 commits across 4 files, adding 177 lines and removing 11 lines\./);
  // Top-3 busiest files by churn, basename WITHOUT extension (footer.ts→footer …).
  assert.match(r.briefing, /The most changed files include footer, action and README\./);
  // Commit SUBJECTS become sentences; the body line is NOT spoken.
  assert.match(r.briefing, /feat\(render\): add audio fallback\./);
  assert.match(r.briefing, /fix\(action\): harden Piper pipeline\./);
  assert.doesNotMatch(r.briefing, /This body line MUST be ignored/);
  // Honest disclosure that this is the commit-based fallback.
  assert.match(r.briefing, /generated from the commit history because an AI briefing was not available/);

  // The whole briefing is a single line — Piper's stdin contract is one line;
  // the synth sanitiser strips stray newlines too, but the source is clean.
  assert.doesNotMatch(r.briefing, /\n/);
  assert.match(r.stdout, /📝 commit-based fallback briefing: wrote \d+ chars \(3 commit\(s\), 4 file\(s\)\)\./);
});

test('no-op: an existing AI briefing means the fallback writes nothing', () => {
  const h = buildHarness({ briefing: 'A real AI handover briefing already exists.' });
  const r = runStep(h);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /🧠 AI briefing present \(\d+ chars\) — commit-based fallback not needed\./);
  assert.equal(r.briefing, '', 'fallback file must NOT be written when the AI briefing exists');
});

test('skip: no commits AND no files → no fallback file written', () => {
  const h = buildHarness({ writeCommitsFile: false, writeStatsFile: false, title: '' });
  const r = runStep(h);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /⏭️  No commits or file changes available/);
  assert.equal(r.briefing, '', 'nothing to summarize → no audio source produced');
});

test('singular grammar: 1 commit / 1 file reads "1 commit across 1 file"', () => {
  const h = buildHarness({
    title: '',
    commits: [{ subject: 'only one change here' }],
    stats: [[5, 2, 'solo.go']],
  });
  const r = runStep(h);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.briefing, /It contains 1 commit across 1 file, adding 5 lines and removing 2 lines\./);
  // Empty title → the "It is titled" sentence is omitted.
  assert.doesNotMatch(r.briefing, /It is titled/);
  assert.match(r.briefing, /only one change here\./);
});

test('grounding: files-only PR (no commit subjects parsed) still summarizes the churn', () => {
  // Degenerate: a commit with an empty subject yields no subject sentence, but
  // the file churn still carries the summary.
  const h = buildHarness({
    title: 'Generated changes',
    commits: [{ subject: '' }],
    stats: [[30, 4, 'pkg/handler.py'], [2, 1, 'pkg/util.py']],
  });
  const r = runStep(h);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.briefing, /It changes 2 files, adding 32 lines and removing 5 lines\.|It contains 1 commit/);
  assert.match(r.briefing, /handler/);
});

test('cap: more than 12 commits → at most 12 subject sentences are spoken', () => {
  const commits = Array.from({ length: 20 }, (_, i) => ({ subject: `commit subject number ${i + 1}` }));
  const h = buildHarness({ commits, stats: [[1, 0, 'x.ts']] });
  const r = runStep(h);
  assert.equal(r.status, 0, r.stderr);
  // The lead-in counts the FULL total (20), but only 12 subjects are listed.
  assert.match(r.briefing, /It contains 20 commits/);
  const spoken = [...r.briefing.matchAll(/commit subject number (\d+)\./g)].map((m) => Number(m[1]));
  assert.ok(spoken.length <= 12, `expected ≤12 subject sentences, got ${spoken.length}`);
});

test('security: raw commit/title text is NEVER echoed to the step log (log-injection)', () => {
  // The fallback step writes untrusted commit/title text to a FILE; the synth
  // step logs only the POST-sanitised version (with `::` folded to `.`). The
  // fallback step itself must not echo the raw subject/title to stdout, or a
  // crafted commit could smuggle a `::error::` workflow command to column 0.
  const h = buildHarness({
    title: 'PWNTITLE::error::owned',
    commits: [{ subject: '::set-output name=x::PWNSUBJECT' }],
    stats: [[1, 0, 'a.ts']],
  });
  const r = runStep(h);
  assert.equal(r.status, 0, r.stderr);
  // The payloads land in the FILE (defanged later by the synth sanitiser)…
  assert.match(r.briefing, /PWNSUBJECT/);
  // …but NEVER in the step's own stdout.
  assert.doesNotMatch(r.stdout, /PWNTITLE/);
  assert.doesNotMatch(r.stdout, /PWNSUBJECT/);
  assert.doesNotMatch(r.stdout, /::error::/);
  assert.doesNotMatch(r.stdout, /::set-output/);
});

// ───────────────────── structural guards (wiring) ─────────────────────

test('wiring: the fallback runs WITHOUT a Models preflight gate (covers the Models-down case)', () => {
  // The whole point of the fallback is to ship audio when GitHub Models is
  // unreachable. So — unlike the AI briefing step (8d-pre) — it must NOT be
  // gated on the preflight status, only on audio being enabled + a real scan.
  const gate = String(fallbackStep().if ?? '');
  assert.doesNotMatch(gate, /preflight_status/, 'fallback must NOT gate on the Models preflight');
  assert.match(gate, /audio-summary/, 'fallback gated on audio-summary');
  assert.match(gate, /scan_ran == 'true'/, 'fallback gated on a real scan');
  assert.match(gate, /head_sha != ''/, 'fallback gated on a resolved head SHA');
});

test('wiring: the fallback is fed the diff artifacts (commits + numstat) from step 6b', () => {
  const env = fallbackStep().env ?? {};
  assert.match(String(env.COMMITS_PATH ?? ''), /steps\.diff\.outputs\.commits_path/, 'reads commits_path');
  assert.match(String(env.STATS_PATH ?? ''), /steps\.diff\.outputs\.stats_path/, 'reads stats_path');
  // It must read the SAME AI-briefing path the synth step reads, to detect the
  // AI-present no-op.
  assert.match(String(env.BRIEFING_PATH ?? ''), /drift-pr-briefing\.txt/, 'reads the AI briefing path');
  assert.match(String(env.FALLBACK_BRIEFING_PATH ?? ''), /drift-pr-briefing-fallback\.txt/, 'writes the fallback path');
});
