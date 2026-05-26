// Top banner — overall_drift chip + interpretation + confidence.
//
// GitHub strips <style>/class/style attrs, so color comes from:
//   1. GFM alert blocks (> [!TIP] / [!WARNING] / [!NOTE]) — colored callouts
//   2. shields.io badge images — colored pills via <img src=…>
//   3. emoji arrows (▲ / ▼ / —) for direction

import type { OverallDrift } from '../../report.ts';

type DirectionStyle = {
  alert: 'TIP' | 'WARNING' | 'NOTE';
  arrow: string;
  badgeColor: string; // hex without leading #
};

const DIRECTION: Record<OverallDrift['direction'], DirectionStyle> = {
  up:      { alert: 'TIP',     arrow: '▲', badgeColor: '2ea043' },
  down:    { alert: 'WARNING', arrow: '▼', badgeColor: 'f85149' },
  neutral: { alert: 'NOTE',    arrow: '—', badgeColor: '6e7681' },
};

export function renderBanner(drift?: OverallDrift): string | null {
  if (!drift) return null;

  const style = DIRECTION[drift.direction];
  const signed = formatSignedPercent(drift.percent);
  const interp = drift.interpretation ? ` — ${drift.interpretation}` : '';
  const badge = buildBadge(signed, style.badgeColor);

  return [
    `> [!${style.alert}]`,
    `> **Drift ${style.arrow} ${signed}**${interp} &nbsp;·&nbsp; confidence \`${drift.confidence}\``,
    `>`,
    `> ![Drift score](${badge})`,
  ].join('\n');
}

function formatSignedPercent(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '' : '';
  return `${sign}${Math.round(n * 10) / 10}%`;
}

// shields.io URL — sign is URL-encoded as %2B (+) so the badge renders correctly.
function buildBadge(signedPercent: string, color: string): string {
  const value = encodeURIComponent(signedPercent);
  return `https://img.shields.io/badge/drift-${value}-${color}?style=flat-square`;
}
