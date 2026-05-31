// ✅ Before you merge — the actionable, GitHub-tallied checklist. Moved out of
// the header to the END of the comment (it reads as the closing "action items"
// list, after the reviewer has seen the findings). The task boxes stay visible
// (not inside a <details>) so GitHub tallies merge-readiness as they're ticked.
//
// Items are synthesised deterministically from PrFacts via buildChecklist (NOT
// an LLM call), so the list is reproducible and testable.

import type { PrContext } from '../context.ts';
import { buildChecklist } from '../lib/checklist.ts';
import { progressBar } from '../lib/bars.ts';
import type { PrFacts } from '../lib/facts.ts';

export function renderBeforeMerge(facts: PrFacts, ctx?: PrContext): string {
  const items = buildChecklist(facts, ctx);
  if (items.length === 0) {
    return ['## ✅ Before you merge', '', '_Nothing blocking — Drift found no gating issues. Advisory review only._'].join('\n');
  }
  const boxes = items.map((t) => `- [ ] ${t}`);
  const readiness = `> **Merge readiness** &nbsp; \`${progressBar(0, items.length)}\` &nbsp; **0 / ${items.length}** — GitHub tallies the boxes above as you check them off.`;
  return ['## ✅ Before you merge', '', ...boxes, '', readiness].join('\n');
}
