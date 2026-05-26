// Sticky overview comment — top-down per pr-review-spec.md:
//   0. Banner             — overall_drift chip (GFM alert + shields.io badge)
//   1. Architecture flow  — pr_review.architecture_flow (Image 1)
//   2. Business logic     — pr_review.business_logic (Image 2)
//   3. Affected roots     — pr_scope (factual — always present)
//   4. Value card         — pr_review.value_card + counts (Image 3)
//   5. Suggestions        — pr_review.code_suggestions (warnings, advisory)
//   6. Visual summary     — pr_review.visual_summary (collapsible)
//   7. Extended findings  — pr_review_ext
//
// Suggestions ALSO post as inline review comments (see github/review.ts)
// for the "Apply suggestion" button — but they're mirrored here so the PR
// author still sees them when GitHub rejects the inline review (a single
// out-of-diff anchor makes the whole atomic createReview call fail).

import type { Generator, ScanPrOutput } from '../report.ts';
import { renderBanner } from './sections/banner.ts';
import { renderArchitecture } from './sections/architecture.ts';
import { renderBusinessLogic } from './sections/business_logic.ts';
import { renderAffectedRoots } from './sections/affected_roots.ts';
import { renderValueCard } from './sections/value_card.ts';
import { renderSuggestions } from './sections/suggestions.ts';
import { renderVisualSummary } from './sections/visual_summary.ts';
import { renderExt } from './sections/ext.ts';

export const STICKY_MARKER = '<!-- drift:sticky-comment -->';

// GitHub caps comment bodies at 65 536 chars. We aim for 60 000 to leave
// headroom for the marker + future small additions.
const BODY_SIZE_BUDGET = 60_000;

export function renderOverview(report: ScanPrOutput): string {
  const header = `${STICKY_MARKER}\n## 🟣 Drift PR review`;

  const sections: (string | null)[] = [
    header,
    renderBanner(report.pr_review?.overall_drift),
    renderArchitecture(report.pr_review?.architecture_flow),
    renderBusinessLogic(report.pr_review?.business_logic),
    renderAffectedRoots(report.pr_scope.affected_roots, report.pr_scope.unreachable_changes),
    renderValueCard(report.pr_review?.counts, report.pr_review?.value_card),
    renderSuggestions(report.pr_review?.code_suggestions),
    renderVisualSummary(report.pr_review?.visual_summary),
    renderExt(report.pr_review_ext),
    renderFooter(report.generator),
  ];

  const body = sections.filter((s): s is string => !!s).join('\n\n---\n\n');
  return guardSize(body);
}

function renderFooter(gen: Generator): string {
  return `<sub>Posted by [Drift](https://drift.dev) · static-analysis report from \`${gen.tool}\` v${gen.version}</sub>`;
}

// If the body breaches the size budget, collapse <details>…</details> blocks
// to their <summary> line only. Keeps the comment well under GitHub's 65 536
// char cap while preserving the section headings + factual content.
function guardSize(body: string): string {
  if (body.length <= BODY_SIZE_BUDGET) return body;
  const stripped = body.replace(
    /<details><summary>([\s\S]*?)<\/summary>[\s\S]*?<\/details>/g,
    (_match, summary) => `<details><summary>${summary} — _collapsed (body size guard)_</summary></details>`,
  );
  return stripped;
}
