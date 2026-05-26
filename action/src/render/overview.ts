// Sticky overview comment. Composed top-down per pr-review-spec.md:
//   1. Architecture flow  (pr_review.architecture_flow — scanner pre-renders Mermaid)
//   2. Affected entry points  (pr_scope.affected_roots)
//   3. Value card / counts  (pr_review.value_card + counts)
//
// Suggestions live as INLINE review comments, not in this overview.

import type {
  ScanPrOutput,
  ArchitectureFlow,
  PrCounts,
  ValueCard,
  PrReviewExt,
} from '../report.ts';

export const STICKY_MARKER = '<!-- drift:sticky-comment -->';

export function renderOverview(report: ScanPrOutput): string {
  const lines: string[] = [STICKY_MARKER, '## 🟣 Drift PR review', ''];

  const arch = report.pr_review?.architecture_flow;
  if (arch) {
    lines.push(renderArchitecture(arch));
    lines.push('');
  }

  lines.push(renderAffectedRoots(report.pr_scope.affected_roots, report.pr_scope.unreachable_changes));
  lines.push('');

  const counts = report.pr_review?.counts;
  const card = report.pr_review?.value_card;
  if (counts || card) {
    lines.push(renderValueCard(counts, card));
    lines.push('');
  }

  if (report.pr_review_ext) {
    const extBlock = renderPrReviewExt(report.pr_review_ext);
    if (extBlock) {
      lines.push(extBlock);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(
    '<sub>Posted by [Drift](https://drift.dev) · static-analysis report from `drift-static-profiler` ' +
      `v${report.generator.version}</sub>`,
  );
  return lines.join('\n');
}

// ─── Architecture (scanner pre-renders Mermaid; we just frame it) ───────

function renderArchitecture(arch: ArchitectureFlow): string {
  const lines = ['## Architecture flow', ''];

  if (arch.combined_mermaid) {
    lines.push('```mermaid', arch.combined_mermaid, '```');
  } else {
    if (arch.before_mermaid) {
      lines.push('### Before');
      lines.push('```mermaid', arch.before_mermaid, '```');
    }
    if (arch.after_mermaid) {
      lines.push('');
      lines.push('### After');
      lines.push('```mermaid', arch.after_mermaid, '```');
    }
  }

  if (arch.data_structures && arch.data_structures.length) {
    lines.push('', '### Data structures involved', '');
    lines.push('| Name | Kind | Scope | Notes |');
    lines.push('|---|:---:|---|---|');
    for (const d of arch.data_structures) {
      lines.push(
        `| \`${d.name}\`${d.version ? ` ${d.version}` : ''} | ${d.kind} | ${d.scope ?? '—'} | ${d.description ?? ''} |`,
      );
    }
  }

  if (arch.reference_link?.url) {
    lines.push('', `Reference: [${arch.reference_link.title ?? arch.reference_link.url}](${arch.reference_link.url})`);
  }
  return lines.join('\n');
}

// ─── Affected roots (from pr_scope) ─────────────────────────────────────

const MAX_ROOTS_SHOWN = 10;

export function renderAffectedRoots(
  affectedRoots: string[],
  unreachable: string[],
): string {
  if (affectedRoots.length === 0 && unreachable.length === 0) {
    return '## Affected entry points\n\n_No entry points reached by this PR. The change is internal or unreachable from any root._';
  }

  const lines = ['## Affected entry points', ''];
  if (affectedRoots.length) {
    lines.push(`**${affectedRoots.length}** entry point${affectedRoots.length === 1 ? '' : 's'} reach changes from this PR.`);
    lines.push('');
    const shown = affectedRoots.slice(0, MAX_ROOTS_SHOWN);
    for (const r of shown) {
      lines.push(`- \`${r}\``);
    }
    if (affectedRoots.length > shown.length) {
      lines.push(`- _…+${affectedRoots.length - shown.length} more_`);
    }
  }

  if (unreachable.length) {
    lines.push('', `### Unreachable changes (${unreachable.length})`, '');
    lines.push("These files changed but no entry point reaches them — they're likely dead code, configuration, or tests.");
    lines.push('');
    for (const f of unreachable.slice(0, 10)) {
      lines.push(`- \`${f}\``);
    }
    if (unreachable.length > 10) {
      lines.push(`- _…+${unreachable.length - 10} more_`);
    }
  }

  return lines.join('\n');
}

// ─── Value card (counts + axes) ─────────────────────────────────────────

function renderValueCard(counts?: PrCounts, card?: ValueCard): string {
  const lines = ['## Value card', ''];

  if (counts) {
    const chips: string[] = [];
    if (counts.features) chips.push(`✨ **${counts.features.value}** ${counts.features.label}`);
    if (counts.bug_fixes) chips.push(`🐛 **${counts.bug_fixes.value}** ${counts.bug_fixes.label}`);
    if (counts.issues_resolved) chips.push(`✅ **${counts.issues_resolved.value}** ${counts.issues_resolved.label}`);
    if (counts.new_test_files) chips.push(`🧪 **${counts.new_test_files.value}** ${counts.new_test_files.label}`);
    if (chips.length) {
      lines.push(chips.join(' · '));
      lines.push('');
    }
  }

  if (card?.axes?.length) {
    lines.push('| Axis | Δ% | Direction | Confidence |');
    lines.push('|---|---:|:---:|:---:|');
    for (const a of card.axes) {
      const dir = a.direction === 'up' ? '🟢 ▲' : a.direction === 'down' ? '🔴 ▼' : '—';
      lines.push(`| ${a.label} | ${formatPercent(a.delta_percent)} | ${dir} | ${a.confidence} |`);
    }
    if (card.bottom_line) {
      lines.push('', `> ${card.bottom_line}`);
    }
  }

  return lines.join('\n');
}

function formatPercent(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${Math.round(n * 10) / 10}%`;
}

// ─── pr_review_ext: tech debt + duplication + tests + NFR ──────────────

function renderPrReviewExt(ext: PrReviewExt): string | null {
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
    lines.push('These entry points have no test file reaching them in the call graph:');
    lines.push('');
    for (const u of uncovered.slice(0, 10)) lines.push(`- \`${u}\``);
    if (uncovered.length > 10) lines.push(`- _…+${uncovered.length - 10} more_`);
    blocks.push(lines.join('\n'));
  }

  const gaps = ext.nfr_edge_cases?.reliability_gaps ?? [];
  if (gaps.length > 0) {
    const lines = [`### 🛡️ Reliability gaps (${gaps.length})`, ''];
    lines.push('These entry points lack retry / timeout / circuit / fallback markers:');
    lines.push('');
    for (const g of gaps.slice(0, 10)) lines.push(`- \`${g}\``);
    if (gaps.length > 10) lines.push(`- _…+${gaps.length - 10} more_`);
    blocks.push(lines.join('\n'));
  }

  const hi = ext.tech_debt?.high_complexity ?? [];
  const long = ext.tech_debt?.long_functions ?? [];
  if (hi.length + long.length > 0) {
    const lines = ['### ⚠️ Tech debt findings', ''];
    if (hi.length) {
      lines.push(`- **${hi.length}** high-complexity function${hi.length === 1 ? '' : 's'} (threshold ${ext.tech_debt!.thresholds?.complexity ?? 10})`);
    }
    if (long.length) {
      lines.push(`- **${long.length}** long function${long.length === 1 ? '' : 's'} (threshold ${ext.tech_debt!.thresholds?.loc ?? 80} LOC)`);
    }
    blocks.push(lines.join('\n'));
  }

  if (blocks.length === 0) return null;
  return ['## Extended findings', '', blocks.join('\n\n')].join('\n');
}
