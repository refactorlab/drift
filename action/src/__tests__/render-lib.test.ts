// Unit tests for the pure render helpers (format / bars / severity / context /
// state). These are the foundation every section builds on, so they're pinned
// hard — including the exact ⅛-block glyphs the template specifies.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  signedPercent,
  signedNumber,
  magnitudePercent,
  confidencePercent,
  signedInt,
  int,
  plural,
  escapeHtml,
  inlineList,
  basename,
  fencedBlock,
} from '../render/lib/format.ts';
import { magnitudeBar, progressBar } from '../render/lib/bars.ts';
import { compositeStatus, maxAbsDelta, directionEmoji, directionWord, COLOR } from '../render/lib/severity.ts';
import { fileLink, permalinkUrl, repoSlug, canLink, snippetPermalink, symbolLink, type PrContext } from '../render/context.ts';
import { parseState, serializeState, stateFromReport, sinceLastReview, type DriftState } from '../render/state.ts';
import type { ScanPrOutput } from '../report.ts';

// ── format ────────────────────────────────────────────────────────────────

test('signedPercent: sign, U+2212 minus, one decimal, zero', () => {
  assert.equal(signedPercent(10.3), '+10.3%');
  assert.equal(signedPercent(-15.9), '−15.9%'); // U+2212
  assert.equal(signedPercent(0), '0.0%');
  assert.equal(signedPercent(3), '+3.0%');
});

test('signedNumber: no unit (for pp deltas)', () => {
  assert.equal(signedNumber(2.1), '+2.1');
  assert.equal(signedNumber(-1), '−1.0');
  assert.equal(signedNumber(0), '0.0');
});

test('magnitudePercent / confidencePercent / signedInt / int', () => {
  assert.equal(magnitudePercent(-15.9), '15.9%');
  assert.equal(confidencePercent(0.78), '78%');
  assert.equal(confidencePercent(1), '100%');
  assert.equal(signedInt(2175), '+2,175');
  assert.equal(signedInt(-88), '−88');
  assert.equal(signedInt(0), '0');
  assert.equal(int(2263), '2,263');
});

test('plural / basename', () => {
  assert.equal(plural(1, 'file'), 'file');
  assert.equal(plural(2, 'file'), 'files');
  assert.equal(plural(2, 'is', 'are'), 'are');
  assert.equal(basename('src/lib/theme.ts'), 'theme.ts');
  assert.equal(basename('theme.ts'), 'theme.ts');
});

test('fencedBlock sizes the fence past inner backtick runs', () => {
  assert.equal(fencedBlock('plain', 'diff'), '```diff\nplain\n```');
  const out = fencedBlock('a ``` b'); // inner run of 3 → fence must be 4
  assert.ok(out.startsWith('````\n'), `fence too short: ${out}`);
  assert.ok(out.endsWith('\n````'));
  const big = fencedBlock('x `````` y'); // inner run of 6 → fence of 7
  assert.ok(big.startsWith('```````\n'));
});

test('escapeHtml escapes the five entities', () => {
  assert.equal(escapeHtml('a & b < c > "d" \'e\''), 'a &amp; b &lt; c &gt; &quot;d&quot; &#39;e&#39;');
});

test('inlineList caps and appends a more-tail', () => {
  assert.equal(inlineList(['a', 'b', 'c'], 2), '`a` · `b` · *…+1 more*');
  assert.equal(inlineList(['a', 'b'], 5), '`a` · `b`');
  assert.equal(inlineList(['App', '<module>'], 5, false), 'App · <module>');
});

// ── bars ──────────────────────────────────────────────────────────────────

test('magnitudeBar matches the template ⅛-block glyphs', () => {
  // From improved-pr-comment.md, max axis = 60:
  assert.equal(magnitudeBar(60, 60), '██████████'); // customer +60
  assert.equal(magnitudeBar(-15.9, 60), '██▋░░░░░░░'); // money −15.9 → 2.65 cells
  assert.equal(magnitudeBar(-3, 60), '▌░░░░░░░░░'); // runtime −3 → 0.5 cells
  assert.equal(magnitudeBar(0, 60), '░░░░░░░░░░'); // runtime ux flat
  assert.equal(magnitudeBar(10.3, 60), '█▊░░░░░░░░'); // composite +10.3
});

test('magnitudeBar is always exactly `cells` glyphs and clamps', () => {
  for (const v of [-100, -3.3, 0, 7.7, 50, 999]) {
    assert.equal([...magnitudeBar(v, 60)].length, 10, `len for ${v}`);
  }
  assert.equal(magnitudeBar(5, 0), '░░░░░░░░░░'); // max 0 → empty track
  assert.equal(magnitudeBar(5, NaN), '░░░░░░░░░░');
  assert.equal(magnitudeBar(999, 60), '██████████'); // clamps to full
});

test('progressBar fills proportionally', () => {
  assert.equal(progressBar(0, 5), '░░░░░░░░░░');
  assert.equal(progressBar(5, 5), '██████████');
  assert.equal(progressBar(1, 2), '█████░░░░░');
  assert.equal(progressBar(0, 0), '░░░░░░░░░░'); // no division by zero
});

// ── severity / composite ────────────────────────────────────────────────────

test('compositeStatus: divergent signs are amber "mixed"', () => {
  const mixed = compositeStatus([
    { direction: 'down' },
    { direction: 'up' },
    { direction: 'neutral' },
  ]);
  assert.equal(mixed.label, 'mixed');
  assert.equal(mixed.emoji, '🟡');
  assert.equal(mixed.color, COLOR.amber);
  assert.equal(mixed.mixed, true);
});

test('compositeStatus: pure up = green, pure down = red, flat = grey', () => {
  assert.deepEqual(compositeStatus([{ direction: 'up' }, { direction: 'up' }]).label, 'improved');
  assert.equal(compositeStatus([{ direction: 'up' }]).emoji, '🟢');
  assert.equal(compositeStatus([{ direction: 'down' }]).emoji, '🔴');
  assert.equal(compositeStatus([{ direction: 'down' }]).label, 'regressed');
  assert.equal(compositeStatus([{ direction: 'neutral' }]).emoji, '⚪');
  assert.equal(compositeStatus(undefined).label, 'no change');
  assert.equal(compositeStatus([]).emoji, '⚪');
});

test('maxAbsDelta / directionEmoji / directionWord', () => {
  assert.equal(maxAbsDelta([{ delta_percent: -15.9 }, { delta_percent: 60 }]), 60);
  assert.equal(maxAbsDelta(undefined), 0);
  assert.equal(directionEmoji('up'), '🟢');
  assert.equal(directionEmoji('down'), '🔴');
  assert.equal(directionEmoji('neutral'), '⚪');
  assert.equal(directionWord('up'), 'improved');
  assert.equal(directionWord('down'), 'regressed');
  assert.equal(directionWord('neutral'), 'no change');
});

// ── context / permalinks ────────────────────────────────────────────────────

const CTX: PrContext = { owner: 'refactorlab', repo: 'andy', sha: 'abc123', prTitle: 't' };

test('permalinkUrl: line, range, and bare', () => {
  assert.equal(permalinkUrl(CTX, 'src/a.tsx', 61), 'https://github.com/refactorlab/andy/blob/abc123/src/a.tsx#L61');
  assert.equal(permalinkUrl(CTX, 'src/a.tsx', 58, 64), 'https://github.com/refactorlab/andy/blob/abc123/src/a.tsx#L58-L64');
  assert.equal(permalinkUrl(CTX, 'src/a.tsx'), 'https://github.com/refactorlab/andy/blob/abc123/src/a.tsx');
  assert.equal(snippetPermalink(CTX, 'src/a.tsx', 58, 64), 'https://github.com/refactorlab/andy/blob/abc123/src/a.tsx#L58-L64');
});

test('permalink helpers fall back to code spans without context', () => {
  assert.equal(permalinkUrl(undefined, 'a.ts', 1), null);
  assert.equal(canLink(undefined), false);
  assert.equal(canLink(CTX), true);
  assert.equal(repoSlug(CTX), 'refactorlab/andy');
  assert.equal(repoSlug({}), null);
  assert.equal(fileLink(undefined, 'src/a.tsx', 61), '`a.tsx:61`');
  assert.equal(fileLink(CTX, 'src/a.tsx', 61), '[`a.tsx:61`](https://github.com/refactorlab/andy/blob/abc123/src/a.tsx#L61)');
  assert.equal(symbolLink(undefined, 'Hero', 'src/Hero.tsx', 21), '`Hero`');
  assert.equal(symbolLink(CTX, 'Hero', 'src/Hero.tsx', 21), '[`Hero`](https://github.com/refactorlab/andy/blob/abc123/src/Hero.tsx#L21)');
});

test('permalinkUrl encodes odd path segments but keeps slashes', () => {
  assert.equal(
    permalinkUrl(CTX, 'src/components/My File.tsx', 3),
    'https://github.com/refactorlab/andy/blob/abc123/src/components/My%20File.tsx#L3',
  );
});

// ── state / since-last-review ───────────────────────────────────────────────

function reportWithAxes(axes: { name: string; delta: number }[], overall?: number): ScanPrOutput {
  return {
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: 't' },
    pr_scope: { changed_files: [], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      overall_drift: overall === undefined ? undefined : { percent: overall, direction: 'up', confidence: 'low' },
      value_card: {
        axes: axes.map((a) => ({
          name: a.name as 'money',
          label: a.name,
          delta_percent: a.delta,
          direction: a.delta > 0 ? 'up' : a.delta < 0 ? 'down' : 'neutral',
          confidence: 'low',
        })),
      },
    },
  };
}

test('stateFromReport snapshots overall + per-axis', () => {
  const s = stateFromReport(reportWithAxes([{ name: 'money', delta: 2.9 }, { name: 'customer', delta: 60 }], 21));
  assert.equal(s.v, 1);
  assert.equal(s.overall, 21);
  assert.deepEqual(s.axes, { money: 2.9, customer: 60 });
});

test('serializeState / parseState round-trip; tolerant of junk', () => {
  const s: DriftState = { v: 1, overall: 10.3, axes: { money: -15.9 } };
  const blob = serializeState(s);
  assert.match(blob, /^<!-- drift:state \{.*\} -->$/);
  assert.deepEqual(parseState(`body\n${blob}\n`), s);
  assert.equal(parseState('no marker here'), null);
  assert.equal(parseState(''), null);
  assert.equal(parseState(undefined), null);
  assert.equal(parseState('<!-- drift:state {bad json -->'), null);
  assert.equal(parseState('<!-- drift:state {"v":2} -->'), null); // wrong version
});

test('parseState recovers a full 4-axis blob despite a nested object + decoy comments', () => {
  const full: DriftState = { v: 1, overall: 21, axes: { money: 2.9, customer: 60, runtime: 15, runtime_ux: 6 } };
  const body = `## head\n\n<!-- decoy --> text\n${serializeState(full)}\n`;
  assert.deepEqual(parseState(body), full); // the `-->` anchor forces capture of BOTH braces
});

test('sinceLastReview: per-axis pp deltas; null on no-prior or no-move', () => {
  const prior: DriftState = { v: 1, axes: { money: 0.8, runtime: -2 } };
  const current: DriftState = { v: 1, axes: { money: 2.9, runtime: -3, customer: 60 } };
  // money +2.1pp, runtime −1.0pp; customer has no prior → skipped
  assert.equal(sinceLastReview(prior, current), '💰 ▲ +2.1pp · ⚙️ ▼ −1.0pp');
  assert.equal(sinceLastReview(null, current), null);
  assert.equal(sinceLastReview({ v: 1, axes: { money: 2.9 } }, { v: 1, axes: { money: 2.9 } }), null); // no move
});
