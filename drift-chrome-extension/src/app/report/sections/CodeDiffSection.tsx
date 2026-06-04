// Code diff — the literal +/- hunks per file, collected client-side from the
// PR's unified .diff and carried inside the scan-pr JSON (`pr_diff`). One
// collapsed disclosure per file; opening it shows the added (green) and removed
// (red) lines with their surrounding context, exactly like a diff viewer.

import { Fragment } from 'react';
import type { ScanOutput } from '../../../core/scanOutput';
import type { DiffLineType, FileDiff } from '../../../core/prDiff';
import { Section, Badge, Collapsible, type Tone } from '../primitives';

const STATUS: Record<FileDiff['status'], { label: string; tone: Tone }> = {
  A: { label: 'added', tone: 'good' },
  M: { label: 'modified', tone: 'warn' },
  D: { label: 'removed', tone: 'bad' },
  R: { label: 'renamed', tone: 'info' },
  C: { label: 'copied', tone: 'info' },
  T: { label: 'type', tone: 'muted' },
};
const SIGN: Record<DiffLineType, string> = { add: '+', del: '-', context: ' ' };
const FILE_CAP = 60;

export function CodeDiffSection({ report }: { report: ScanOutput }) {
  const all = report.pr_diff?.files ?? [];
  const files = all.filter((f) => f.hunks.length > 0); // text changes only
  if (files.length === 0) return null;
  const shown = files.slice(0, FILE_CAP);
  const overflow = files.length - shown.length;

  return (
    <Section icon="±" title="Code diff" action={<Badge>{files.length} file{files.length === 1 ? '' : 's'}</Badge>}>
      {shown.map((f, i) => {
        const st = STATUS[f.status];
        return (
          <Collapsible
            key={`${f.path}-${i}`}
            title={f.oldPath ? `${f.oldPath} → ${f.path}` : f.path}
            subtitle={
              <span className="rp-diff-sub">
                <Badge tone={st.tone}>{st.label}</Badge>{' '}
                <span className="rp-loc-add">+{f.additions}</span>{' '}
                <span className="rp-loc-del">−{f.deletions}</span>
              </span>
            }
          >
            <pre className="rp-diff">
              <code>
                {f.hunks.map((h, hi) => (
                  <Fragment key={hi}>
                    <span className="rp-diff-hunk">{h.header}</span>
                    {'\n'}
                    {h.lines.map((l, li) => (
                      <span key={li} className={`rp-diff-line rp-diff-${l.type}`}>
                        {SIGN[l.type]}
                        {l.text}
                        {'\n'}
                      </span>
                    ))}
                  </Fragment>
                ))}
                {f.truncated && <span className="rp-muted">… diff truncated (file too large)</span>}
              </code>
            </pre>
          </Collapsible>
        );
      })}
      {overflow > 0 && <p className="rp-muted rp-more">+{overflow} more file(s) changed</p>}
    </Section>
  );
}
