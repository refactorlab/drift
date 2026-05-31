// 🎯 Blast radius & coverage — the principal-engineer question "if this breaks,
// what breaks, and is it tested?", answered from the static call graph. For each
// entry point that REACHES the change: is a test covering it, and which
// reliability families (retry / timeout / fallback) are missing. This is a claim
// only a real call-graph tool can make — LLM-first reviewers can't — and it
// turns the bare "0 tests" alarm into a named, actionable list.
//
// Backs the hero's merge-confidence score. Omitted entirely when there's no
// call-graph coverage data, or when everything reached is tested AND guarded
// (nothing to act on — the value card / architecture already tell the good news).

import type { PrFacts, RootCoverage } from '../lib/facts.ts';
import { int, plural, inlineList } from '../lib/format.ts';

const MAX_ROWS = 15;
const MAX_TESTLIST = 10;
const MAX_GUARDS = 3; // families per row — keep the column scannable, not a wall

export function renderBlastRadius(facts: PrFacts): string | null {
  const rows = facts.perRootCoverage;
  if (rows.length === 0) return null;

  const untested = rows.filter((r) => !r.tested);
  const unguarded = rows.filter((r) => r.missing.length > 0);
  if (untested.length === 0 && unguarded.length === 0) return null; // nothing to act on

  // Highest-exposure first: untested before tested, then by missing-guard count.
  const sorted = [...rows].sort(
    (a, b) => Number(a.tested) - Number(b.tested) || b.missing.length - a.missing.length || a.root.localeCompare(b.root),
  );

  const lines: string[] = ['## 🎯 Blast radius & coverage', ''];

  const summary =
    `**${int(rows.length)}** entry ${plural(rows.length, 'point')} reach this change · ` +
    `**${int(untested.length)}** untested · **${int(unguarded.length)}** lack reliability guards.`;
  lines.push(summary, '');

  lines.push('| Entry point | Tested | Missing guards |', '|---|:--:|---|');
  for (const r of sorted.slice(0, MAX_ROWS)) {
    const tested = r.tested ? '🟢 yes' : '🔴 **no**';
    lines.push(`| \`${escapeCell(r.root)}\` | ${tested} | ${missingGuards(r.missing)} |`);
  }
  if (sorted.length > MAX_ROWS) {
    lines.push(`| *…+${sorted.length - MAX_ROWS} more* | | |`);
  }
  lines.push('');

  if (untested.length > 0) {
    const names = untested.map((r) => r.root);
    lines.push(`> **Before merge, add tests for:** ${inlineList(names, MAX_TESTLIST)}.`);
  }

  return lines.join('\n').trimEnd();
}

/** Top few missing families + a "+N" tail, so the column stays scannable. */
function missingGuards(missing: string[]): string {
  if (missing.length === 0) return '—';
  const shown = missing.slice(0, MAX_GUARDS).map(escapeCell).join(', ');
  return missing.length > MAX_GUARDS ? `${shown} *+${missing.length - MAX_GUARDS}*` : shown;
}

/** A reached root is a symbol name; keep `|` and backticks from breaking the table. */
function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/`/g, "'");
}
