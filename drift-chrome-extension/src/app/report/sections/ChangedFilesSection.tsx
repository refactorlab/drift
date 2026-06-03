// Changed files — the literal "what this PR touches" view: every changed file
// with its git status (added / modified / removed / renamed / copied) and LOC.
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

function loc(f: ChangedFileStatus): string {
  if (f.code === 'D') return `−${f.deletions}`;
  if (f.code === 'A') return `+${f.additions}`;
  return `+${f.additions} −${f.deletions}`;
}

export function ChangedFilesSection({ files }: { files?: ChangedFileStatus[] }) {
  if (!files || files.length === 0) return null;

  const counts = ORDER.map((code) => ({
    code,
    n: files.filter((f) => f.code === code).length,
  })).filter((c) => c.n > 0);

  const sorted = [...files].sort(
    (a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code) || a.path.localeCompare(b.path),
  );

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
      <table className="rp-table rp-changed-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>File</th>
            <th>Lines</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((f, i) => (
            <tr key={`${f.path}-${i}`}>
              <td>
                <Badge tone={STATUS[f.code].tone} filled>
                  {STATUS[f.code].label}
                </Badge>
              </td>
              <td>
                {f.oldPath ? (
                  <code className="rp-rename">
                    <span className="rp-rename-old">{f.oldPath}</span> → {f.path}
                  </code>
                ) : (
                  <code>{f.path}</code>
                )}
              </td>
              <td className="rp-muted rp-loc">{loc(f)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
