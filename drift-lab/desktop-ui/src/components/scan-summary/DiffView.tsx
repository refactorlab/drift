import type { DiffLine } from "./parseSuggestion";

/**
 * Pure presentational render of a parsed unified diff.
 *
 * Visual model is GitHub-PR: a two-column grid per line — a small "prefix
 * gutter" carrying the +/- glyph in colored text, and a content column
 * with whitespace-preserved code. Whole rows tint red (removed) or green
 * (added); hunk headers render in a muted bar.
 *
 * Streaming: when `streaming` is true the view appends a trailing row
 * containing only the blinking caret, signalling "more lines incoming".
 * The caret lives in its own row so the last rendered diff line never
 * jitters in width as the caret blinks.
 *
 * No state, no effects — the parent re-renders this on every body delta
 * (already RAF-batched upstream), so this component is trivially
 * memoizable if profiling ever calls for it.
 */
interface Props {
  lines: DiffLine[];
  streaming: boolean;
}

export default function DiffView({ lines, streaming }: Props) {
  return (
    <div className="diff-view" role="figure" aria-label="suggested code change">
      {lines.map((line, i) => (
        <DiffRow key={i} line={line} />
      ))}
      {streaming && (
        <div className="diff-row diff-row-streaming">
          <span className="diff-prefix" aria-hidden />
          <span className="diff-content">
            <span className="scan-suggestion-caret" aria-hidden />
          </span>
        </div>
      )}
    </div>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  if (line.kind === "hunk") {
    return (
      <div className="diff-row diff-row-hunk">
        <span className="diff-content">{line.text}</span>
      </div>
    );
  }
  if (line.kind === "meta") {
    return (
      <div className="diff-row diff-row-meta">
        <span className="diff-content">{line.text}</span>
      </div>
    );
  }
  const prefix = line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " ";
  return (
    <div className={`diff-row diff-row-${line.kind}`}>
      <span className="diff-prefix" aria-hidden>{prefix}</span>
      <span className="diff-content">{line.text || " "}</span>
    </div>
  );
}
