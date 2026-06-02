// Architecture — the diagrams that answer "what does this PR touch?". Renders
// the scanner's pre-built Mermaid graphs (call-graph diff, business-logic reach,
// key-files mindmap) plus the structured data-structures table, each in its own
// disclosure card.

import type { ArchitectureFlow, BusinessLogic, KeyFilesBlock, DataStructureEntry } from '../../../core/scanOutput';
import { Badge, Collapsible, Section, type Tone } from '../primitives';
import { MermaidDiagram } from '../MermaidDiagram';

function primaryDiagram(a?: ArchitectureFlow): string | null {
  return (
    a?.diff_merged_mermaid?.trim() ||
    a?.combined_mermaid?.trim() ||
    a?.after_mermaid?.trim() ||
    a?.before_mermaid?.trim() ||
    null
  );
}

const KIND_TONE: Record<string, Tone> = {
  new: 'good',
  modified: 'warn',
  removed: 'bad',
  unchanged: 'muted',
};

function DataStructures({ items }: { items: DataStructureEntry[] }) {
  return (
    <table className="rp-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Kind</th>
          <th>Language</th>
          <th>Scope</th>
        </tr>
      </thead>
      <tbody>
        {items.map((d, i) => (
          <tr key={i}>
            <td><code>{d.name}</code></td>
            <td><Badge tone={KIND_TONE[d.kind] ?? 'muted'}>{d.kind}</Badge></td>
            <td>{d.scope ?? '—'}</td>
            <td className="rp-muted">{d.description ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ArchitectureSection({
  arch,
  business,
  keyFiles,
}: {
  arch?: ArchitectureFlow;
  business?: BusinessLogic;
  keyFiles?: KeyFilesBlock;
}) {
  const diagram = primaryDiagram(arch);
  const ds = arch?.data_structures ?? [];
  const hasAny = diagram || business?.mermaid || keyFiles?.mermaid || ds.length > 0;
  if (!hasAny) return null;

  return (
    <Section icon="🏗" title="Architecture">
      {diagram && (
        <Collapsible title="Call graph — color-coded diff" defaultOpen>
          <MermaidDiagram source={diagram} />
        </Collapsible>
      )}
      {business?.mermaid && (
        <Collapsible title="Business-logic reach" subtitle={business.summary ? undefined : undefined}>
          {business.summary && <p className="rp-prose">{business.summary}</p>}
          <MermaidDiagram source={business.mermaid} />
        </Collapsible>
      )}
      {ds.length > 0 && (
        <Collapsible title="Data structures touched" subtitle={<Badge>{ds.length}</Badge>}>
          <DataStructures items={ds} />
        </Collapsible>
      )}
      {keyFiles?.mermaid && (
        <Collapsible title="Key files — hot-touch mindmap">
          <MermaidDiagram source={keyFiles.mermaid} />
        </Collapsible>
      )}
    </Section>
  );
}
