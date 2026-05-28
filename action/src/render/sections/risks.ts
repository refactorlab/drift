// 🛰 Risks — the risk register as an impact-ordered table + the quadrant map.
//
// Split out of the old "visual summary" so risks read as a first-class section
// (the template surfaces "N of M land in Act before merge" up top, then the
// table, then the quadrant chart in a <details>). The chart is the scanner's
// pre-rendered, theme-matched quadrantChart — framed verbatim, never rebuilt.

import type { RisksBlock, RiskItem } from '../../report.ts';
import { plural } from '../lib/format.ts';

const QUADRANT: Record<NonNullable<RiskItem['quadrant']>, { emoji: string; label: string; rank: number }> = {
  act_before_merge: { emoji: '🔴', label: 'Act before merge', rank: 0 },
  monitor_closely: { emoji: '🟡', label: 'Monitor closely', rank: 1 },
  document_and_ship: { emoji: '🔵', label: 'Document & ship', rank: 2 },
  acceptable: { emoji: '🟢', label: 'Acceptable', rank: 3 },
};

export function renderRisks(risks?: RisksBlock): string | null {
  const items = risks?.items ?? [];
  if (items.length === 0 && !risks?.mermaid) return null;

  const lines: string[] = ['## 🛰 Risks', ''];

  if (items.length > 0) {
    const act = items.filter((r) => r.quadrant === 'act_before_merge').length;
    lines.push(intro(act, items.length), '');
    lines.push('| Risk | Likelihood | Severity | Quadrant |', '|---|---:|---:|---|');
    for (const r of sortByImpact(items)) {
      lines.push(`| ${cell(r.label)} | ${prob(r.likelihood)} | ${prob(r.severity)} | ${quadrant(r)} |`);
    }
    lines.push('');
  }

  if (risks?.mermaid) {
    lines.push(
      '<details>',
      '<summary>🗺 Risk quadrant map (severity ↑ × likelihood →)</summary>',
      '',
      '```mermaid',
      risks.mermaid,
      '```',
      '',
      '</details>',
    );
  }

  return lines.join('\n').trimEnd();
}

function intro(act: number, total: number): string {
  if (act === 0) {
    return `**0 of ${total}** ${plural(total, 'risk')} land in *Act before merge* — none gate the merge. Lower-impact ${plural(total, 'risk')} below:`;
  }
  return `**${act} of ${total}** ${plural(total, 'risk')} land in *Act before merge*. Highest-priority first:`;
}

function sortByImpact(items: RiskItem[]): RiskItem[] {
  return [...items].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      b.severity - a.severity ||
      b.likelihood - a.likelihood ||
      a.label.localeCompare(b.label),
  );
}

function rank(r: RiskItem): number {
  return r.quadrant ? QUADRANT[r.quadrant].rank : 99;
}

function quadrant(r: RiskItem): string {
  if (!r.quadrant) return '—';
  const q = QUADRANT[r.quadrant];
  return `${q.emoji} ${q.label}`;
}

function prob(p: number): string {
  return p.toFixed(2);
}

function cell(s: string): string {
  return s.replace(/\|/g, '\\|');
}
