// The "scroll execution plan" for a handover step — the ordered line RANGES the
// review dwells on, paced to how long each is explained. Instead of a blind linear
// sweep through the whole file (which races past a 1300-line diff), the reviewer's
// view stops on each actual CHANGED region (a diff hunk) for as long as the
// narration about it takes to read (chat) or speak (voice).
//
// Ranges are DETERMINISTIC — parsed from the unified diff's `@@ … +start,count @@`
// headers, so they're always accurate. The dwell PER range is LLM-driven: the
// per-hunk narration (tagged `[H1] … [H2] …`) gives each its own text, and longer
// explanations dwell longer. If the model omits tags, we fall back to the hunk diff
// itself as the text (dwell ∝ hunk size) — so the plan is never empty or wrong.
//
// All pure + unit-tested; the browser side (prNavigate.runScrollPlanInPage) just
// executes the steps this produces.

import type { FileGraph } from '../core/changeImpactGraph';

/** Reading (chat) / TTS-speaking (voice) rates in words/minute — pace each dwell.
 *  225 wpm is the standard average-reader rate; voice is slower (Kokoro ≈ 155). */
export const TEXT_WPM = 225;
export const VOICE_WPM = 155;

/** One changed region of a file: its new-side line range + the diff text. */
export interface DiffHunk {
  index: number;
  startLine: number;
  endLine: number;
  /** New-side line number of the FIRST added (`+`) line in the hunk, or undefined for a
   *  pure deletion (no added line to land on). This is the "closest changed line" the
   *  reviewer should scroll to — the GitHub diff collapses far context, so an added line
   *  is what's actually on screen, not the context line at the hunk's top. */
  changedStart?: number;
  /** New-side line number of the LAST added line — the changed span to highlight. */
  changedEnd?: number;
  /** The hunk's unified-diff text (header + +/-/space lines). */
  text: string;
}

/** A narrated, LABELLED range — the LLM's chosen spot: its line range, a short
 *  symbol/concept label (the clickable-button text) and the one-sentence note. */
export interface PresentSegment {
  startLine: number;
  endLine: number;
  /** Button text — the symbol/concept (e.g. "VadEngine class", "pushMic()"). */
  label: string;
  /** The one-sentence explanation (drives display + dwell timing). */
  note: string;
  /** The bare symbol identifier (e.g. "pushMic") when this beat is a real
   *  tree-sitter symbol — lets the in-page highlighter emphasise just the NAME
   *  within the line (sub-line). Absent for plain line-range beats. */
  name?: string;
  /** OVERVIEW beat: instead of holding on one line, the page starts at the TOP of the
   *  file and slow-scrolls (reading-speed paced) down to the first change while Level 1 +
   *  Level 2 are read. Set only on the synthetic lead beat (buildOverviewBeat). */
  sweep?: boolean;
}

/** One executable / clickable beat: scroll-highlight this range, dwell `dwellMs`. */
export interface PresentBeat extends PresentSegment {
  dwellMs: number;
}

/** The 3-LEVEL file framing the walkthrough shows ABOVE the per-change sections:
 *  Level 1 = what this PR changes in THIS file overall, Level 2 = what the file does
 *  (high → low). Level 3 is the section list (the beats). Grounded in content + diff. */
export interface FileOverview {
  /** Level 1 — the PR's overall change to this file, in one line. */
  prChange: string;
  /** Level 2 — what the file does: a high-level sentence, then a low-level one. */
  purpose: string;
}

/** A file's clickable presentation — carried from the handover to the chat message
 *  so each beat becomes a button that replays the scroll+highlight from that spot. */
export interface FilePresentation {
  path: string;
  /** The file's `diff-<sha256(path)>` anchor (to drive the in-page scroller). */
  anchorId: string;
  beats: PresentBeat[];
  /** The file-scoped change-impact call graph (the file's blast radius), rendered as
   *  an interactive diagram inside the message. Absent when the scan has no structured
   *  graph or the file maps to no node. Travels with the message (persisted in chat). */
  graph?: FileGraph;
  /** Epoch ms when the page scroll began. Lets the chat's active-beat highlight
   *  (presentationClock) re-sync to the spot the page is already dwelling on, even
   *  when the (spoken) reply bubble renders a moment after the scroll started. */
  startedAt?: number;
  /** The framing the chat renders AROUND the inline section list: `intro` is the
   *  "Opened X — file N of M" header, `outro` the "Proceed to Y?" footer. The beats
   *  themselves are the body (one inline button + note per spot). */
  intro?: string;
  outro?: string;
  /** Level 1 + Level 2 framing, rendered above the section list (Level 3). */
  overview?: FileOverview;
}

/** The minimal shape the in-page scroller needs (PresentBeat satisfies it). */
export interface ScrollStep {
  startLine: number;
  endLine: number;
  dwellMs: number;
  /** Optional symbol identifier — the in-page highlighter emphasises it sub-line. */
  name?: string;
  /** OVERVIEW beat — slow-sweep from the file top to the first change (see PresentSegment). */
  sweep?: boolean;
}

/** Estimate how long `text` takes to read/speak at `wpm` (standard word-count ÷
 *  words-per-minute method), clamped so one short segment isn't a blink and a giant
 *  one doesn't stall for minutes. */
export function estimateReadingMs(text: string, wpm: number, minMs = 1200, maxMs = 20000): number {
  if (!text || !text.trim()) return minMs;
  const words = text.trim().split(/\s+/).length;
  const ms = (words / Math.max(1, wpm)) * 60000;
  return Math.round(Math.min(maxMs, Math.max(minMs, ms)));
}

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/** The rendered line number CLOSEST to `target` (ties → the lower one). Used in-page when
 *  the exact changed line isn't in the DOM (GitHub virtualises / collapses the diff) so we
 *  scroll to the nearest line that IS shown rather than jumping to the file top. The
 *  in-page scroller inlines the same logic (it can't import); this is the unit-tested
 *  source of truth. Returns null for an empty list. Pure. */
export function nearestRenderedLine(rendered: number[], target: number): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const n of rendered) {
    const d = Math.abs(n - target);
    if (d < bestDist || (d === bestDist && best !== null && n < best)) {
      best = n;
      bestDist = d;
    }
  }
  return best;
}

/** Number the NEW side of a unified diff: each changed/context line tagged with its
 *  real file line number, the set of those line numbers (to validate LLM citations),
 *  and the hunks (fallback ranges). Pure — this is what we SHOW the model so it can
 *  cite EXACT lines, and what we validate its `[L…]` picks against. */
export function analyzeDiff(diff: string, maxLines = 160): { numbered: string; valid: Set<number>; hunks: DiffHunk[] } {
  const hunks = parseDiffHunks(diff);
  const valid = new Set<number>();
  const rows: string[] = [];
  let n = 0;
  for (const line of diff.split('\n')) {
    const h = line.match(HUNK_HEADER);
    if (h) {
      n = Number(h[1]);
      continue;
    }
    if (!n) continue;
    const c = line[0];
    if (c === '+' || c === ' ') {
      if (rows.length < maxLines) rows.push(`${n}: ${line}`);
      valid.add(n);
      n++;
    } else if (c === '-') {
      // Show REMOVED lines (the "before") so the model describes the actual CHANGE, not
      // just the new state — they carry no new-side number (nothing to navigate to).
      if (rows.length < maxLines) rows.push(`    ${line}`);
    }
  }
  return { numbered: rows.join('\n'), valid, hunks };
}

/** Turn a file's CONTENT into an all-added unified diff so a walkthrough can ground on
 *  REAL lines even when the per-file diff wasn't cached — a brand-new file (all of it
 *  IS the change) or a diff the size budget dropped on a big PR. Capped so a huge file
 *  stays prompt-sized. Without this, a file with no diff + no symbols fell to a prose
 *  path where the small model INVENTED functions that aren't in the file. */
export function syntheticAddedDiff(content: string, maxLines = 400): string {
  const lines = content.split('\n');
  const n = Math.min(lines.length, Math.max(1, maxLines));
  const body = lines
    .slice(0, n)
    .map((l) => `+${l}`)
    .join('\n');
  return `@@ -0,0 +1,${n} @@\n${body}`;
}

/** Parse the model's beat tags — `[S<n>]` / `[S<a>-S<b>]` (symbol picks) AND
 *  `[L<a>-<b>: label]` / `[L<a>-L<b>]` (line picks) — into ordered, narrated segments.
 *  Handles BOTH kinds in ONE in-order pass (the small model routinely mixes them and
 *  emits RANGES with an `S`/`L` prefix on the second number, e.g. `[S10-S19]`,
 *  `[L222-L231]`). Drops a pick that resolves to nothing (out-of-range symbol / unshown
 *  line — a hallucination) and clamps a giant span. The text BETWEEN a tag and the next
 *  is that beat's note. Pure. */
export function parseBeats(raw: string, symbols: FileSymbol[], valid: Set<number>, maxSpan = 40): PresentSegment[] {
  // Alt 1: [S a (-S? b)?]   Alt 2: [L a (-L? b)? (: label)?]
  const re = /\[\s*S\s*(\d+)\s*(?:[-–]\s*S?\s*(\d+))?\s*\]|\[\s*L\s*(\d+)\s*(?:[-–]\s*L?\s*(\d+))?\s*(?::\s*([^\]]+?))?\s*\]/gi;
  type Mark = { kind: 'S' | 'L'; a: number; b: number; label: string; pos: number; end: number };
  const marks: Mark[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    if (m[1] != null) marks.push({ kind: 'S', a: Number(m[1]), b: m[2] ? Number(m[2]) : Number(m[1]), label: '', pos: m.index, end: re.lastIndex });
    else marks.push({ kind: 'L', a: Number(m[3]), b: m[4] ? Number(m[4]) : Number(m[3]), label: (m[5] ?? '').trim(), pos: m.index, end: re.lastIndex });
  }
  const segs: PresentSegment[] = [];
  for (let i = 0; i < marks.length; i++) {
    const mk = marks[i];
    const note = raw.slice(mk.end, i + 1 < marks.length ? marks[i + 1].pos : raw.length).trim();
    if (mk.kind === 'S') {
      const sa = symbols[mk.a];
      if (!sa) continue; // out-of-range symbol index → drop (hallucinated)
      const sb = symbols[mk.b] ?? sa;
      const endLine = Math.max(sa.end_line, Math.min(sb.end_line, sa.line + 60)); // cap a wide range
      const label = sa.parent ? `${sa.parent}.${sa.name}` : sa.name;
      segs.push({ startLine: sa.line, endLine, label, note: note || label, name: sa.name });
    } else {
      if (!valid.has(mk.a)) continue; // start line was never shown → drop (hallucinated)
      const endLine = Math.max(mk.a, Math.min(mk.b, mk.a + maxSpan));
      segs.push({ startLine: mk.a, endLine, label: mk.label || `lines ${mk.a}-${endLine}`, note: note || mk.label || `lines ${mk.a}-${endLine}` });
    }
  }
  return segs;
}

/** Parse a unified-diff string into its hunks' NEW-side line ranges + text, AND each
 *  hunk's CHANGED span (the first/last added line) so the walkthrough can land on a real
 *  changed line, not the leading context line. Pure. */
export function parseDiffHunks(diff: string): DiffHunk[] {
  const out: DiffHunk[] = [];
  let cur: DiffHunk | null = null;
  let buf: string[] = [];
  let lineNo = 0; // running NEW-side line number within the current hunk
  const flush = () => {
    if (cur) {
      cur.text = buf.join('\n');
      out.push(cur);
      buf = [];
    }
  };
  for (const line of diff.split('\n')) {
    const m = line.match(HUNK_HEADER);
    if (m) {
      flush();
      const start = Number(m[1]);
      const count = m[2] ? Number(m[2]) : 1;
      cur = { index: out.length, startLine: start, endLine: start + Math.max(0, count - 1), text: '' };
      lineNo = start;
      buf.push(line);
    } else if (cur) {
      buf.push(line);
      // Track the new-side line number so we can record where the ADDED lines actually sit.
      const c = line[0];
      if (c === '+') {
        if (cur.changedStart === undefined) cur.changedStart = lineNo;
        cur.changedEnd = lineNo;
        lineNo++;
      } else if (c === '-') {
        // removed line — no new-side number, doesn't advance the counter
      } else {
        lineNo++; // context line
      }
    }
  }
  flush();
  return out;
}

/** A changed file's tree-sitter symbol (the profiler's `pr_symbols` shape). */
export interface FileSymbol {
  name: string;
  kind: string;
  line: number;
  end_line: number;
  parent?: string;
}

/** The numbered symbol MENU shown to the model — it picks spots by index (`[S<n>]`),
 *  so beats anchor on REAL spans (no line-number hallucination). */
export function formatSymbolMenu(symbols: FileSymbol[]): string {
  return symbols
    .map((s, i) => `[S${i}] ${s.parent ? `${s.parent}.` : ''}${s.name} (${s.kind}) L${s.line}-${s.end_line}`)
    .join('\n');
}

/** Deterministic beats straight from the symbol map — used when the model didn't
 *  tag its picks (a small model may ignore the format) OR when there's no diff to
 *  fall back to. Guarantees a symbol-anchored presentation whenever symbols exist. */
export function symbolFallbackSegments(symbols: FileSymbol[], max = 6): PresentSegment[] {
  return symbols.slice(0, max).map((s) => ({
    startLine: s.line,
    endLine: s.end_line,
    label: s.parent ? `${s.parent}.${s.name}` : s.name,
    note: `The ${s.kind} ${s.parent ? `${s.parent}.${s.name}` : s.name}.`,
    name: s.name,
  }));
}

/** When the model gives no usable line beats, dwell on each hunk weighted by size. */
export function hunkFallbackSegments(hunks: DiffHunk[]): PresentSegment[] {
  return hunks.map((h) => ({
    startLine: h.startLine,
    endLine: h.endLine,
    label: `change at line ${h.startLine}`,
    note: h.text,
  }));
}

/** The INNERMOST symbol whose span encloses [startLine, endLine] — the specific
 *  function/class the changed lines sit in, NOT the file-level `module` node (skipped) or
 *  a giant outer wrapper. Used to NAME a changed hunk with a real symbol. Pure. */
export function symbolForRange(symbols: FileSymbol[], startLine: number, endLine: number): FileSymbol | undefined {
  let best: FileSymbol | undefined;
  for (const s of symbols) {
    if (s.kind === 'module' || s.line > endLine || s.end_line < startLine) continue; // skip the file node / non-overlapping
    if (!best || s.end_line - s.line < best.end_line - best.line) best = s; // smallest (innermost) span wins
  }
  return best;
}

/** One walkthrough SECTION: a line range to scroll to + highlight, a button label, the
 *  symbol name (sub-line highlight), and the code `ref` we show the model to annotate. */
export interface PresentSection extends PresentSegment {
  ref: string;
}

/** Build the ORDERED sections to walk for a MODIFIED file — ONE per changed HUNK, so
 *  every spot is LITERALLY in the diff (never unchanged code elsewhere in the file).
 *  Each is labeled by the innermost symbol it touches (a real function/class name) or its
 *  line range. The model only ANNOTATES these (a weak model PICKED unchanged whole-file
 *  symbols → "navigated to code that isn't in the changes"). Pure. */
export function buildSections(hunks: DiffHunk[], symbols: FileSymbol[], maxSpan = 40, max = 6): PresentSection[] {
  const lbl = (s: FileSymbol) => (s.parent ? `${s.parent}.${s.name}` : s.name);
  return hunks.slice(0, max).map((h) => {
    // The hunk's CHANGED-line range (what's actually on screen — GitHub collapses far
    // context), from the first changed line (or the hunk start for a pure deletion), clamped
    // so a giant hunk doesn't paint the whole file.
    const changeStart = h.changedStart ?? h.startLine;
    const changeEnd = Math.max(changeStart, Math.min(h.changedEnd ?? h.endLine, changeStart + maxSpan));
    const s = symbolForRange(symbols, changeStart, changeEnd);
    // Navigate to the MOST SPECIFIC accurate range: the OVERLAP of the change and the matched
    // tree-sitter symbol's exact span. For a tight hunk inside a function that's the changed
    // lines; for a whole-file change (a new file) it's the SYMBOL's span — so we land on
    // `gaugeDisplay` (line 22), not the file top. No symbol → the changed lines (the default).
    const startLine = s ? Math.max(changeStart, s.line) : changeStart;
    const endLine = Math.max(startLine, s ? Math.min(changeEnd, s.end_line) : changeEnd);
    return {
      startLine,
      endLine,
      label: s ? lbl(s) : `lines ${startLine}–${endLine}`,
      name: s?.name,
      note: '',
      ref: h.text,
    };
  });
}

/** Sections for a file with NO usable diff (a NEW file, or a truncated cache): ONE per
 *  top symbol, with the symbol's CODE shown so the model ANNOTATES it under the SAME
 *  `[H<n>]` contract as the hunk path — so the descriptions are real words, not the bare
 *  "The function X." the old symbol-PICK fallback produced. `content` supplies the code. */
export function buildSymbolSections(symbols: FileSymbol[], content: string, maxSpan = 40, max = 6): PresentSection[] {
  const lines = content ? content.split('\n') : [];
  return symbols.slice(0, max).map((s) => {
    const endLine = Math.max(s.line, Math.min(s.end_line, s.line + maxSpan));
    const refEnd = Math.min(endLine, s.line + 12); // signature + first lines is enough to annotate
    return {
      startLine: s.line,
      endLine,
      label: s.parent ? `${s.parent}.${s.name}` : s.name,
      name: s.name,
      note: '',
      ref: lines.slice(s.line - 1, refEnd).join('\n'),
    };
  });
}

/** The deterministic note for a section the model DIDN'T annotate: the first real line of
 *  its code/diff (the signature / first changed line) — informative, unlike a bare "The
 *  function X." Strips diff/whitespace markers and the `@@` hunk header. Pure. */
export function sectionFallbackNote(ref: string, label: string): string {
  const line = ref
    .split('\n')
    .map((l) => l.replace(/^[+\- ]\s?/, '').trim())
    .find((l) => l && !l.startsWith('@@'));
  return line ? line.slice(0, 120) : `Change in ${label}.`;
}

/** Parse the model's `PR:` / `FILE:` / `DETAIL:` header lines into the 3-level file
 *  overview (Level 1 = PR change, Level 2 = purpose high→low). Returns null when the
 *  model emitted none — the caller then falls back to deterministic framing. Pure. */
export function parseFileOverview(raw: string): FileOverview | null {
  const grab = (tag: string): string => {
    const m = raw.match(new RegExp(`^\\s*${tag}\\s*[:\\-]\\s*(.+?)\\s*$`, 'im'));
    return m ? m[1].trim() : '';
  };
  const prChange = grab('PR');
  const purpose = [grab('FILE'), grab('DETAIL')].filter(Boolean).join(' ');
  if (!prChange && !purpose) return null;
  return { prChange, purpose };
}

/** Parse the model's per-change annotations `[H<n>] <sentence>` into notes by hunk index.
 *  The model ANNOTATES the deterministic sections — it never picks spots — so the labels
 *  (real symbols) and ranges (real hunks) can't be hallucinated. Pure. */
export function parseHunkNotes(raw: string): Map<number, string> {
  const re = /\[H\s*(\d+)\s*\]\s*/gi;
  const marks: Array<{ i: number; pos: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) marks.push({ i: Number(m[1]), pos: m.index, end: re.lastIndex });
  const notes = new Map<number, string>();
  for (let k = 0; k < marks.length; k++) {
    const note = raw.slice(marks[k].end, k + 1 < marks.length ? marks[k + 1].pos : raw.length).trim();
    if (note) notes.set(marks[k].i, note.replace(/\s+/g, ' '));
  }
  return notes;
}

/** Time each labelled segment into a clickable / executable beat (dwell = how long
 *  its note reads/speaks). The result drives BOTH the auto-presentation (it satisfies
 *  ScrollStep) and the message buttons (it carries the label + note). */
export function buildPresentBeats(segments: PresentSegment[], wpm: number): PresentBeat[] {
  return segments.map((s) => ({ ...s, dwellMs: estimateReadingMs(s.note, wpm) }));
}

/** The clickable LABEL of the overview lead beat (Level 1 + Level 2 phase). */
export const OVERVIEW_LABEL = 'Overview';

/** When a `leadText` (the intro header, e.g. "Opened X — file 1 of 60 (critical)") is
 *  folded in, the start beat dwells at LEAST this long — the reviewer needs time to read
 *  the header + Level 1 + Level 2 before the changes scroll past (the "give it ~10s at the
 *  start" ask). Without a lead text (unit tests) the smaller 2.5s floor applies. */
export const MIN_OVERVIEW_DWELL_MS = 10_000;

/** Build the OVERVIEW lead beat: a synthetic first beat that owns the Level 1 + Level 2
 *  reading phase. When it plays, the page starts at the TOP of the file and slow-scrolls
 *  (paced to how long the intro header + L1 + L2 take to read/speak) down to the first
 *  changed line — then the change beats take over. Its dwell is that reading time (so the
 *  timeline shows the phase as its OWN segment, not hidden in the first change). `leadText`
 *  is the intro header shown ABOVE the box — its reading time counts toward the dwell, and
 *  raises the floor so the start always lasts a readable beat. Pure. */
export function buildOverviewBeat(overview: FileOverview, firstChangeLine: number, wpm: number, leadText = ''): PresentBeat {
  const note = [overview.prChange, overview.purpose].filter(Boolean).join(' '); // the L1+L2 shown in the box
  const readText = [leadText, note].filter(Boolean).join(' '); // header + L1 + L2 — everything read at the start
  const minMs = leadText ? MIN_OVERVIEW_DWELL_MS : 2500;
  return {
    startLine: 1, // the top of the file
    endLine: Math.max(1, firstChangeLine), // …sweep down to where the changes start
    label: OVERVIEW_LABEL,
    note,
    sweep: true,
    dwellMs: estimateReadingMs(readText, wpm, minMs, 45000),
  };
}

/** Remove EVERY beat tag — `[S<n>]`, `[H<n>]`, `[L<a>-<b>: label]`, AND the ranged /
 *  prefixed forms the small model actually emits (`[S10-S19]`, `[L222-L231]`) — from the
 *  narration shown/spoken, so the prose stays clean (the scroll + highlight carry the
 *  ranges). The OLD regex matched only single `[S\d]` / `[L\d-\d]`, so ranges leaked into
 *  the message as literal "[S10-S19]" garbage. Pure. */
export function stripBeatTags(raw: string): string {
  return raw
    .replace(/\[\s*[SHL]\s*\d+(?:\s*[-–]\s*[SHL]?\s*\d+)?(?:\s*:[^\]]*)?\s*\]\s*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
