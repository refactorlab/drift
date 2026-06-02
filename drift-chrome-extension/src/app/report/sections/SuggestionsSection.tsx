// Code suggestions — the scanner's prioritized findings, each a card with its
// severity, location, rationale, optional fix diff, and remediation hint.

import type { CodeSuggestion, CodeDiff, DiffLine } from '../../../core/scanOutput';
import { Badge, Collapsible, Section, type Tone } from '../primitives';

function severityTone(s?: string): Tone {
  switch (s) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'bad';
    case 'medium':
      return 'warn';
    case 'low':
      return 'good';
    default:
      return 'muted';
  }
}

function diffLines(d: CodeDiff): DiffLine[] | null {
  if (d.before_lines?.length || d.after_lines?.length) {
    return [...(d.before_lines ?? []).map((l) => ({ ...l, kind: l.kind ?? ('del' as const) })),
            ...(d.after_lines ?? []).map((l) => ({ ...l, kind: l.kind ?? ('add' as const) }))];
  }
  if (d.unified) {
    return d.unified.split('\n').map((line) => ({
      code: line,
      kind: line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : 'ctx',
    }));
  }
  return null;
}

function DiffBlock({ diff }: { diff: CodeDiff }) {
  const lines = diffLines(diff);
  if (!lines?.length) return null;
  return (
    <pre className="rp-diff">
      {lines.map((l, i) => (
        <div key={i} className={`rp-diff-line rp-diff-${l.kind ?? 'ctx'}`}>
          <span className="rp-diff-gutter">{l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ' '}</span>
          <span className="rp-diff-code">{l.code}</span>
        </div>
      ))}
    </pre>
  );
}

function SuggestionCard({ s }: { s: CodeSuggestion }) {
  const tone = severityTone(s.severity);
  const loc = `${s.file}${s.line ? `:${s.line}` : ''}`;
  return (
    <div className="rp-sugg">
      <div className="rp-sugg-head">
        <Badge tone={tone} filled={s.severity === 'critical' || s.severity === 'high'}>
          {(s.severity ?? 'note').toUpperCase()}
        </Badge>
        <span className="rp-sugg-title">{s.category_label ?? s.kind ?? `Category ${s.category}`}</span>
        {s.source === 'ai' && <Badge tone="info">AI</Badge>}
      </div>
      <div className="rp-sugg-loc" title={loc}>
        <code>{loc}</code>
        {s.function && s.function !== '<module>' && <span className="rp-muted"> · {s.function}()</span>}
      </div>
      {s.summary && <p className="rp-prose">{s.summary}</p>}
      <p className="rp-sugg-why">{s.why_it_matters}</p>
      {s.diff && <DiffBlock diff={s.diff} />}
      {s.remediation_hint && (
        <p className="rp-sugg-fix">
          <Badge tone="good">fix</Badge> {s.remediation_hint}
        </p>
      )}
    </div>
  );
}

export function SuggestionsSection({ suggestions }: { suggestions?: CodeSuggestion[] }) {
  const list = suggestions ?? [];
  if (list.length === 0) return null;
  const TOP = 5;
  const shown = list.slice(0, TOP);
  const overflow = list.length - shown.length;
  return (
    <Section icon="💡" title="Code suggestions" action={<Badge tone="info">{list.length}</Badge>}>
      <div className="rp-suggs">
        {shown.map((s, i) => (
          <SuggestionCard key={i} s={s} />
        ))}
      </div>
      {overflow > 0 && (
        <Collapsible title={`${overflow} more suggestion${overflow > 1 ? 's' : ''}`}>
          <div className="rp-suggs">
            {list.slice(TOP).map((s, i) => (
              <SuggestionCard key={i} s={s} />
            ))}
          </div>
        </Collapsible>
      )}
    </Section>
  );
}
