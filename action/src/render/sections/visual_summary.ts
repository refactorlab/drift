// Visual summary — risks quadrant chart + key-files mindmap.
// Heavy section (two mermaid diagrams + tables) → collapsed by default.
//
// GitHub Mermaid 10.x renders quadrantChart and mindmap, but quadrantChart
// occasionally fails to render (community-tracked). The fallback table
// beneath the chart carries the same data so reviewers can still parse it.

import type { VisualSummary, RiskItem, KeyFileGroup } from '../../report.ts';

const QUADRANT_LABEL: Record<NonNullable<RiskItem['quadrant']>, string> = {
  act_before_merge: 'Act before merge',
  monitor_closely: 'Monitor closely',
  acceptable: 'Acceptable',
  document_and_ship: 'Document & ship',
};

export function renderVisualSummary(vs?: VisualSummary): string | null {
  if (!vs || (!vs.risks && !vs.key_files)) return null;

  const inner: string[] = [];

  if (vs.risks) {
    inner.push('### ⚠️ Risks · severity ↑ × likelihood →', '');
    if (vs.risks.mermaid) {
      inner.push('```mermaid', vs.risks.mermaid, '```', '');
    }
    if (vs.risks.items && vs.risks.items.length) {
      inner.push(renderRiskTable(vs.risks.items), '');
    }
  }

  if (vs.key_files) {
    inner.push('### 🗂 Key files · hot-touch mindmap', '');
    if (vs.key_files.mermaid) {
      inner.push('```mermaid', vs.key_files.mermaid, '```', '');
    }
    if (vs.key_files.groups && vs.key_files.groups.length) {
      inner.push(renderKeyFileGroups(vs.key_files.groups));
    }
  }

  if (inner.length === 0) return null;

  return [
    '<details><summary>🛰 Visual summary — risks &amp; key files</summary>',
    '',
    inner.join('\n'),
    '',
    '</details>',
  ].join('\n');
}

function renderRiskTable(items: RiskItem[]): string {
  const lines = ['| Risk | Likelihood | Severity | Quadrant |', '|---|---:|---:|---|'];
  for (const r of items) {
    const q = r.quadrant ? QUADRANT_LABEL[r.quadrant] : '—';
    lines.push(`| ${r.label} | ${formatProb(r.likelihood)} | ${formatProb(r.severity)} | ${q} |`);
  }
  return lines.join('\n');
}

function renderKeyFileGroups(groups: KeyFileGroup[]): string {
  const lines: string[] = [];
  for (const g of groups) {
    lines.push(`- **${g.name}**`);
    for (const f of g.files) {
      const why = f.why ? ` — ${f.why}` : '';
      lines.push(`  - \`${f.path}\`${why}`);
    }
  }
  return lines.join('\n');
}

function formatProb(p: number): string {
  return p.toFixed(2);
}
