// Commits — the actual commit messages on the PR, reconstructed client-side from
// the .patch (same data the action feeds the scanner via `git log`). Conventional
// Commit prefixes (feat/fix/perf/…) get a colored badge so the intent is scannable.

import { Section, Badge, type Tone } from '../primitives';

const TYPE_TONE: Record<string, Tone> = {
  feat: 'good',
  fix: 'bad',
  perf: 'info',
  refactor: 'info',
  revert: 'bad',
  docs: 'muted',
  test: 'muted',
  chore: 'muted',
  build: 'muted',
  ci: 'muted',
  style: 'muted',
};
const CAP = 40;

/** Conventional-commit type prefix, e.g. `feat(scope)!: …` → `feat`. */
function ccType(subject: string): string | null {
  const m = subject.match(/^(\w+)(?:\([^)]*\))?!?:/);
  return m ? m[1].toLowerCase() : null;
}

export function CommitsSection({ commits }: { commits?: string[] }) {
  if (!commits || commits.length === 0) return null;
  // Newest first (the .patch lists oldest→newest).
  const ordered = [...commits].reverse();
  const shown = ordered.slice(0, CAP);
  const overflow = ordered.length - shown.length;

  return (
    <Section icon="🔀" title="Commits" action={<Badge>{commits.length}</Badge>}>
      <ul className="rp-commits">
        {shown.map((msg, i) => {
          const subject = msg.split('\n', 1)[0];
          const type = ccType(subject);
          return (
            <li key={i} className="rp-commit">
              {type && (
                <Badge tone={TYPE_TONE[type] ?? 'muted'} filled>
                  {type}
                </Badge>
              )}
              <span className="rp-commit-subj">{subject}</span>
            </li>
          );
        })}
      </ul>
      {overflow > 0 && <p className="rp-muted rp-more">+{overflow} more</p>}
    </Section>
  );
}
