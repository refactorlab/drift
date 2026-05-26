// Image 1 — Architecture flow (call-graph diff + data structures).
// Scanner pre-renders the mermaid; we just frame it.

import type { ArchitectureFlow } from '../../report.ts';

export function renderArchitecture(arch?: ArchitectureFlow): string | null {
  if (!arch) return null;

  const lines: string[] = ['## 🏗 Architecture flow', ''];

  if (arch.combined_mermaid) {
    lines.push('```mermaid', arch.combined_mermaid, '```');
  } else {
    if (arch.before_mermaid) {
      lines.push('### Before', '```mermaid', arch.before_mermaid, '```');
    }
    if (arch.after_mermaid) {
      if (arch.before_mermaid) lines.push('');
      lines.push('### After', '```mermaid', arch.after_mermaid, '```');
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
    lines.push(
      '',
      `↳ Reference: [${arch.reference_link.title ?? arch.reference_link.url}](${arch.reference_link.url})`,
    );
  }

  if (lines.length === 2) return null; // header only — nothing to show
  return lines.join('\n');
}
