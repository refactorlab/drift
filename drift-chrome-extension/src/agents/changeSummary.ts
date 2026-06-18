// CHANGE SUMMARY — the Level-3 note generator for the handover walkthrough.
//
// SINGLE RESPONSIBILITY: turn ONE section's code/diff `ref` into a meaningful one-line
// description of WHAT it changed. It replaces the old bare "Change in <symbol>." fallback,
// which said nothing — now the note names the real added / removed line (a signature,
// assignment, JSX element, return, call), so a reviewer reading OR hearing the walkthrough
// learns the actual change even when the small model skips a section's `[H<n>]` annotation.
//
// It only describes what the `ref` literally contains — it never guesses. "Change in X." is
// the genuine last resort (an empty ref), now rare because the change COLLECTOR backfills a
// missing diff before we get here. Pure + unit-tested.

/** A ref split into its added / removed / unchanged code lines, markers stripped. */
export interface SignedLines {
  added: string[];
  removed: string[];
  plain: string[];
}

/** Split a unified-diff (or plain code) ref by line sign. The `@@` hunk header carries no
 *  code; `+`/`-` are the change; everything else is context / plain code. Pure. */
export function splitSigned(ref: string): SignedLines {
  const added: string[] = [];
  const removed: string[] = [];
  const plain: string[] = [];
  for (const line of ref.split('\n')) {
    if (line.startsWith('@@')) continue;
    if (line.startsWith('+')) added.push(line.slice(1).trim());
    else if (line.startsWith('-')) removed.push(line.slice(1).trim());
    else plain.push(line.replace(/^ /, '').trim());
  }
  return { added: added.filter(Boolean), removed: removed.filter(Boolean), plain: plain.filter(Boolean) };
}

/** A line that reads like a declaration / statement worth quoting (signature, assignment,
 *  call, JSX, return) — preferred over an opening brace or stray punctuation. */
const MEANINGFUL =
  /\b(?:function|const|let|var|class|interface|type|enum|export|import|return|async|await|def|fn|struct|impl|public|private|protected)\b|=>|[:=]\s*\S|\w\s*\(|<[A-Za-z]/;

/** The most descriptive line in `lines`: a declaration/statement if present, else the first
 *  non-trivial line, else ''. Pure. */
export function pickMeaningful(lines: string[]): string {
  return lines.find((l) => l.length > 2 && MEANINGFUL.test(l)) ?? lines.find((l) => l.length > 1) ?? '';
}

/** A meaningful one-line summary of a section's change, from its diff/code `ref`:
 *   • added + removed → "Updates <label>: <new line>"  (the after-state, labelled)
 *   • added only      → "Adds <line>"
 *   • removed only    → "Removes <line>"
 *   • no +/- (a symbol section's code) → its signature line
 *   • empty ref       → "Change in <label>."  (last resort)
 *  Clipped to `maxLen`. Pure. */
export function summarizeChange(ref: string, label: string, maxLen = 120): string {
  const { added, removed, plain } = splitSigned(ref);
  const clip = (s: string): string => (s.length > maxLen ? `${s.slice(0, maxLen - 1).trimEnd()}…` : s);
  if (added.length && removed.length) return clip(`Updates ${label}: ${pickMeaningful(added)}`);
  if (added.length) return clip(`Adds ${pickMeaningful(added)}`);
  if (removed.length) return clip(`Removes ${pickMeaningful(removed)}`);
  if (plain.length) return clip(pickMeaningful(plain));
  return `Change in ${label}.`;
}
