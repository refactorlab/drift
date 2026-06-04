// Affected roots — the entry-point symbols this PR's changes reach: functions,
// classes, files, or `anon <file:line>` closures (the labels carry the line/class
// detail). Each is tagged with its diff status (added/changed/removed) pulled
// from the scanner's structured call graph, so you can read "what code moved"
// as a list — the textual companion to the architecture diagram, and the only
// view that survives when the graph is too dense to read.

import type { ScanOutput, MermaidStructured } from '../../../core/scanOutput';
import { Section, Badge, type Tone } from '../primitives';

const CLASS_TONE: Record<string, { label: string; tone: Tone }> = {
  added: { label: 'added', tone: 'good' },
  changed: { label: 'changed', tone: 'warn' },
  removed: { label: 'removed', tone: 'bad' },
};
const CAP = 50;

/** First non-empty structured graph (the diff-merged one has the richest status). */
function pickStructured(report: ScanOutput): MermaidStructured | undefined {
  const a = report.pr_review?.architecture_flow;
  return (
    a?.diff_merged_structured ??
    a?.combined_structured ??
    a?.after_structured ??
    a?.before_structured
  );
}

export function AffectedRootsSection({ report }: { report: ScanOutput }) {
  const roots = report.pr_scope?.affected_roots ?? [];
  if (roots.length === 0) return null;

  // label → diff status, from the structured call graph.
  const statusByLabel = new Map<string, string>();
  for (const n of pickStructured(report)?.nodes ?? []) {
    if (n.class && !statusByLabel.has(n.label)) statusByLabel.set(n.label, n.class);
  }

  // Dedupe while preserving the scanner's reach-sorted order.
  const seen = new Set<string>();
  const uniq = roots.filter((r) => (seen.has(r) ? false : (seen.add(r), true)));
  const shown = uniq.slice(0, CAP);
  const overflow = uniq.length - shown.length;

  const tallies = (['added', 'changed', 'removed'] as const)
    .map((cls) => ({ cls, n: uniq.filter((r) => statusByLabel.get(r) === cls).length }))
    .filter((t) => t.n > 0);

  return (
    <Section
      icon="🎯"
      title="Affected roots"
      action={
        <span className="rp-changed-counts">
          {tallies.length > 0 ? (
            tallies.map((t) => (
              <Badge key={t.cls} tone={CLASS_TONE[t.cls].tone}>
                {t.n} {CLASS_TONE[t.cls].label}
              </Badge>
            ))
          ) : (
            <Badge>{uniq.length}</Badge>
          )}
        </span>
      }
    >
      <ul className="rp-roots">
        {shown.map((label, i) => {
          const cls = statusByLabel.get(label);
          const meta = cls ? CLASS_TONE[cls] : null;
          return (
            <li key={`${label}-${i}`} className="rp-root">
              {meta && (
                <Badge tone={meta.tone} filled>
                  {meta.label}
                </Badge>
              )}
              <code className="rp-root-label">{label}</code>
            </li>
          );
        })}
      </ul>
      {overflow > 0 && <p className="rp-muted rp-more">+{overflow} more (reach-sorted)</p>}
    </Section>
  );
}
