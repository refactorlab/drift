// Affected entry points (factual — derived from pr_scope, always present).

const MAX_ROOTS_SHOWN = 10;
const MAX_UNREACHABLE_SHOWN = 10;

export function renderAffectedRoots(
  affectedRoots: string[],
  unreachable: string[],
): string {
  if (affectedRoots.length === 0 && unreachable.length === 0) {
    return '## 🎯 Affected entry points\n\n_No entry points reached by this PR. The change is internal or unreachable from any root._';
  }

  const lines = ['## 🎯 Affected entry points', ''];

  if (affectedRoots.length) {
    lines.push(
      `**${affectedRoots.length}** entry point${affectedRoots.length === 1 ? '' : 's'} reach changes from this PR.`,
      '',
    );
    const shown = affectedRoots.slice(0, MAX_ROOTS_SHOWN);
    for (const r of shown) lines.push(`- \`${r}\``);
    if (affectedRoots.length > shown.length) {
      lines.push(`- _…+${affectedRoots.length - shown.length} more_`);
    }
  }

  if (unreachable.length) {
    lines.push('', `### Unreachable changes (${unreachable.length})`, '');
    lines.push(
      "These files changed but no entry point reaches them — they're likely dead code, configuration, or tests.",
      '',
    );
    for (const f of unreachable.slice(0, MAX_UNREACHABLE_SHOWN)) lines.push(`- \`${f}\``);
    if (unreachable.length > MAX_UNREACHABLE_SHOWN) {
      lines.push(`- _…+${unreachable.length - MAX_UNREACHABLE_SHOWN} more_`);
    }
  }

  return lines.join('\n');
}
