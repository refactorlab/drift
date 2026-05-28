// 🧪 Extended findings — duplication, uncovered entry points, reliability gaps,
// and tech debt, all tucked inside one collapsible block (it's reference detail,
// not headline). Returns null when there's nothing to report.

import type { PrReviewExt } from '../../report.ts';
import type { PrContext } from '../context.ts';
import { fileLink } from '../context.ts';
import { inlineList, plural, basename } from '../lib/format.ts';

const MAX_DUP = 8;
const MAX_INLINE = 10;

export function renderExt(ext?: PrReviewExt, ctx?: PrContext): string | null {
  if (!ext) return null;

  const inner: string[] = [];

  const clusters = ext.duplication?.clusters ?? [];
  if (clusters.length > 0) {
    const out = [`### 🧬 Duplication (${clusters.length} ${plural(clusters.length, 'cluster')})`, ''];
    for (const c of clusters.slice(0, MAX_DUP)) {
      const members = c.members.map((m) => `\`${m.name}\` in ${fileLink(ctx, m.file, undefined, basename(m.file))}`).join(' ↔ ');
      out.push(`- ${members}`);
    }
    if (clusters.length > MAX_DUP) out.push(`- _…+${clusters.length - MAX_DUP} more ${plural(clusters.length - MAX_DUP, 'cluster')}_`);
    inner.push(out.join('\n'));
  }

  const uncovered = ext.tests_in_graph?.uncovered_roots ?? [];
  if (uncovered.length > 0) {
    inner.push(
      [`### 🧪 Uncovered entry points (${uncovered.length})`, '', 'No test file reaches these in the call graph:', '', inlineList(uncovered, MAX_INLINE)].join('\n'),
    );
  }

  const gaps = ext.nfr_edge_cases?.reliability_gaps ?? [];
  if (gaps.length > 0) {
    inner.push(
      [`### 🛡️ Reliability gaps (${gaps.length})`, '', 'These entry points lack retry / timeout / circuit / fallback markers:', '', inlineList(gaps, MAX_INLINE)].join('\n'),
    );
  }

  const hi = ext.tech_debt?.high_complexity?.length ?? 0;
  const long = ext.tech_debt?.long_functions?.length ?? 0;
  if (hi + long > 0) {
    const out = ['### ⚠️ Tech-debt findings', ''];
    if (hi > 0) out.push(`- **${hi}** high-complexity ${plural(hi, 'function')} (threshold ${ext.tech_debt?.thresholds?.complexity ?? 10})`);
    if (long > 0) out.push(`- **${long}** long ${plural(long, 'function')} (threshold ${ext.tech_debt?.thresholds?.loc ?? 80} LOC)`);
    inner.push(out.join('\n'));
  }

  if (inner.length === 0) return null;

  return [
    '## 🧪 Extended findings',
    '',
    '<details>',
    '<summary>Duplication, uncovered entry points, reliability gaps &amp; tech debt</summary>',
    '',
    inner.join('\n\n'),
    '',
    '</details>',
  ].join('\n');
}
