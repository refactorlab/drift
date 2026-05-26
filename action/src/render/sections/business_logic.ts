// Image 2 — High-level business logic (why does this PR exist).
// Scanner pre-renders the mermaid `flowchart TD`; we frame it with a summary.

import type { BusinessLogic } from '../../report.ts';

export function renderBusinessLogic(bl?: BusinessLogic): string | null {
  if (!bl || (!bl.mermaid && !bl.summary)) return null;

  const lines: string[] = ['## 🧭 Business logic', ''];

  if (bl.summary) {
    lines.push(`> **Summary —** ${bl.summary}`, '');
  }

  if (bl.mermaid) {
    lines.push('```mermaid', bl.mermaid, '```');
  }

  return lines.join('\n');
}
