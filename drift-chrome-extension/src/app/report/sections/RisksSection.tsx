// Risks — the likelihood × severity quadrant. Prefers the structured items
// (native, interactive scatter) and falls back to the scanner's mermaid
// quadrantChart only when no structured items are present.

import type { VisualSummary } from '../../../core/scanOutput';
import { Badge, Section } from '../primitives';
import { RiskQuadrant } from '../RiskQuadrant';
import { MermaidDiagram } from '../MermaidDiagram';

export function RisksSection({ visual }: { visual?: VisualSummary }) {
  const risks = visual?.risks;
  const items = risks?.items ?? [];
  if (items.length === 0 && !risks?.mermaid) return null;

  const gating = items.filter((r) => r.quadrant === 'act_before_merge').length;

  return (
    <Section
      icon="⚠️"
      title="Risks"
      action={
        items.length > 0 ? (
          <Badge tone={gating ? 'bad' : 'good'}>
            {gating ? `${gating} to address` : `${items.length} tracked`}
          </Badge>
        ) : undefined
      }
    >
      {items.length > 0 ? <RiskQuadrant items={items} /> : risks?.mermaid ? <MermaidDiagram source={risks.mermaid} /> : null}
    </Section>
  );
}
