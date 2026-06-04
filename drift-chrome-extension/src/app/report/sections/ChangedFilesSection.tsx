// Changed files — a one-line scope summary: file count + per-status badges
// (added / modified / removed / renamed / copied) + total LOC. The full
// per-file list lives in the PR's own diff view, so we don't duplicate it here.
// Sourced from the client-side `--diff-status` we reconstruct from the unified
// diff, so it ALWAYS shows — independent of whether the changed files appear in
// the call-graph (config/docs PRs have no graph but still have a real diff).

import type { ChangedFileStatus } from '../../../core/prDiff';
import { Badge, Section, type Tone } from '../primitives';

const STATUS: Record<ChangedFileStatus['code'], { label: string; tone: Tone }> = {
  A: { label: 'added', tone: 'good' },
  M: { label: 'modified', tone: 'warn' },
  D: { label: 'removed', tone: 'bad' },
  R: { label: 'renamed', tone: 'info' },
  C: { label: 'copied', tone: 'info' },
  T: { label: 'type', tone: 'muted' },
};
// Status display order: surface adds/removes/renames before the bulk of modifies.
const ORDER: ChangedFileStatus['code'][] = ['A', 'M', 'D', 'R', 'C', 'T'];

export function ChangedFilesSection({ files }: { files?: ChangedFileStatus[] }) {
  if (!files || files.length === 0) return null;

  const counts = ORDER.map((code) => ({
    code,
    n: files.filter((f) => f.code === code).length,
  })).filter((c) => c.n > 0);

  const additions = files.reduce((s, f) => s + (f.additions || 0), 0);
  const deletions = files.reduce((s, f) => s + (f.deletions || 0), 0);

  return (
    <Section
      icon="📝"
      title="Changed files"
      action={
        <span className="rp-changed-counts">
          {counts.map((c) => (
            <Badge key={c.code} tone={STATUS[c.code].tone}>
              {c.n} {STATUS[c.code].label}
            </Badge>
          ))}
        </span>
      }
    >
      {/* One-line summary — the full per-file table lives in the PR's own diff
          view, so here we just headline the scope. */}
      <p className="rp-changed-summary">
        {files.length} file{files.length === 1 ? '' : 's'} changed
        <span className="rp-muted"> · </span>
        <span className="rp-loc-add">+{additions}</span>{' '}
        <span className="rp-loc-del">−{deletions}</span>
      </p>
    </Section>
  );
}
