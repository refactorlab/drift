// pr_review_ext — tech debt, duplication, uncovered roots, NFR reliability gaps.

import type { PrReviewExt } from '../../report.ts';

export function renderExt(ext?: PrReviewExt): string | null {
  if (!ext) return null;

  const blocks: string[] = [];

  const dupCount = ext.duplication?.clusters?.length ?? 0;
  if (dupCount > 0) {
    const lines = [`### 🧬 Duplication (${dupCount} cluster${dupCount === 1 ? '' : 's'})`, ''];
    for (const c of ext.duplication!.clusters.slice(0, 5)) {
      const members = c.members.map((m) => `\`${m.name}\` in \`${m.file}\``).join(' · ');
      lines.push(`- ${members}`);
    }
    if (dupCount > 5) lines.push(`- _…+${dupCount - 5} more cluster(s)_`);
    blocks.push(lines.join('\n'));
  }

  const uncovered = ext.tests_in_graph?.uncovered_roots ?? [];
  if (uncovered.length > 0) {
    const lines = [`### 🧪 Uncovered entry points (${uncovered.length})`, ''];
    lines.push('These entry points have no test file reaching them in the call graph:', '');
    for (const u of uncovered.slice(0, 10)) lines.push(`- \`${u}\``);
    if (uncovered.length > 10) lines.push(`- _…+${uncovered.length - 10} more_`);
    blocks.push(lines.join('\n'));
  }

  const gaps = ext.nfr_edge_cases?.reliability_gaps ?? [];
  if (gaps.length > 0) {
    const lines = [`### 🛡️ Reliability gaps (${gaps.length})`, ''];
    lines.push('These entry points lack retry / timeout / circuit / fallback markers:', '');
    for (const g of gaps.slice(0, 10)) lines.push(`- \`${g}\``);
    if (gaps.length > 10) lines.push(`- _…+${gaps.length - 10} more_`);
    blocks.push(lines.join('\n'));
  }

  const hi = ext.tech_debt?.high_complexity ?? [];
  const long = ext.tech_debt?.long_functions ?? [];
  if (hi.length + long.length > 0) {
    const lines = ['### ⚠️ Tech debt findings', ''];
    if (hi.length) {
      lines.push(
        `- **${hi.length}** high-complexity function${hi.length === 1 ? '' : 's'} (threshold ${ext.tech_debt!.thresholds?.complexity ?? 10})`,
      );
    }
    if (long.length) {
      lines.push(
        `- **${long.length}** long function${long.length === 1 ? '' : 's'} (threshold ${ext.tech_debt!.thresholds?.loc ?? 80} LOC)`,
      );
    }
    blocks.push(lines.join('\n'));
  }

  if (blocks.length === 0) return null;
  return ['## Extended findings', '', blocks.join('\n\n')].join('\n');
}
