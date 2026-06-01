// "Before you merge" — the actionable checklist. Synthesised deterministically
// from PrFacts (NOT an LLM call) so it's reproducible and testable. Each item
// is the markdown that follows `- [ ] `; GitHub re-tallies the boxes as the
// author checks them, which drives the merge-readiness bar.

import type { PrContext } from '../context.ts';
import { fileLink, symbolLink } from '../context.ts';
import { signedPercent, int, plural, basename } from './format.ts';
import type { PrFacts } from './facts.ts';

const MAX_DEAD_EXPORTS_LINKED = 5;
const MAX_CORRECTNESS_LINES = 3;

/** Build the ordered checklist item texts (highest-impact first). */
export function buildChecklist(facts: PrFacts, ctx?: PrContext): string[] {
  const items: string[] = [];

  // 1. Product-correctness — the findings that used to fail the build.
  for (const s of facts.correctness.slice(0, MAX_CORRECTNESS_LINES)) {
    const loc = fileLink(ctx, s.file, s.line);
    const why = correctnessTag(s.category_label);
    items.push(`Fix the product-correctness issue at ${loc}${why ? ` (${why})` : ''}`);
  }
  if (facts.correctness.length > MAX_CORRECTNESS_LINES) {
    const extra = facts.correctness.length - MAX_CORRECTNESS_LINES;
    items.push(`Resolve ${extra} more product-correctness ${plural(extra, 'issue')} (see Suggestions)`);
  }

  // 2. Test gap — code shipped with no new tests. (The +LOC count was dropped —
  // GitHub's PR header already shows it.)
  if (facts.newTestFiles === 0 && (facts.changedFiles > 0 || (facts.locAdded ?? 0) > 0)) {
    items.push('Add tests — this PR shipped **0** new test files');
  }

  // 3. Regressions — axes trending down.
  if (facts.regressedAxes.length > 0) {
    const list = facts.regressedAxes
      .map((a) => `**${a.label} ${signedPercent(a.delta_percent)}**`)
      .join(' and ');
    items.push(`Triage the ${list} ${plural(facts.regressedAxes.length, 'regression')}, or confirm they're acceptable`);
  }

  // 4. Dead exports — unreferenced symbols in changed files.
  if (facts.deadCode.length > 0) {
    const links = facts.deadCode
      .slice(0, MAX_DEAD_EXPORTS_LINKED)
      .map((s) => symbolLink(ctx, deadSymbol(s), s.file, s.line))
      .join(', ');
    const n = facts.deadCode.length;
    const more = n > MAX_DEAD_EXPORTS_LINKED ? `, *…+${n - MAX_DEAD_EXPORTS_LINKED} more*` : '';
    items.push(`Remove or wire up ${n} dead ${plural(n, 'export')}: ${links}${more}`);
  }

  // 5. Reliability — uncovered / unguarded entry points.
  const gaps = facts.reliabilityGaps.length || facts.uncoveredRoots.length;
  if (gaps > 0) {
    items.push(`Decide on retry / timeout / fallback for the ${int(gaps)} uncovered entry ${plural(gaps, 'point')}`);
  }

  return items;
}

// The label after the em-dash, e.g. "Product correctness — Raw SQL concatenation"
// → "raw SQL concatenation" (verbatim suffix, just first letter lowercased so
// it reads naturally inside the parenthetical). Exported so the header's
// "Look here first" focus pointer labels a correctness finding identically.
export function correctnessTag(label?: string): string | null {
  if (!label) return null;
  const idx = label.indexOf('—');
  const suffix = (idx >= 0 ? label.slice(idx + 1) : label).trim();
  if (!suffix || /product correctness/i.test(suffix)) return null;
  return suffix.charAt(0).toLowerCase() + suffix.slice(1);
}

// A readable symbol name for a dead-code finding: the function when it's a real
// identifier, otherwise the file's basename ("<module>" is not a useful label).
function deadSymbol(s: { function?: string; file: string }): string {
  const fn = s.function;
  return fn && fn !== '<module>' && !fn.startsWith('<') ? fn : basename(s.file);
}
