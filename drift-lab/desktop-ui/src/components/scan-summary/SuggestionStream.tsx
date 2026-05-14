import { useMemo } from "react";

import DiffView from "./DiffView";
import { parseSuggestion } from "./parseSuggestion";
import { SEVERITY_COLORS, type Severity } from "./types";

/**
 * Render the live-streaming list of LLM suggestions, GitHub-PR style.
 *
 * Each row carries the analyzer-side context up top (severity badge, file:
 * line, kind, name) and the model output below as either:
 *   - a streaming prose block (while the model is still emitting the `Why:`
 *     rationale before the diff fence), or
 *   - a colored unified diff (red = removed, green = added) once the
 *     ```diff fence has streamed in.
 *
 * The split is decided per-render by {@link parseSuggestion}; the renderer
 * itself holds no state.
 *
 * Streaming caret behavior:
 *   - Prose phase: caret blinks at the tail of the rationale text.
 *   - Diff phase: caret moves into the diff view, blinking on its own
 *     row beneath the last diff line — same "more code on the way" cue
 *     a developer sees in a CI streaming log.
 */

export interface SuggestionRowVM {
  index: number;
  source: "immediate_fix" | "refactor_candidate" | "finding_top";
  kind: string;
  severity: string;
  file: string;
  line: number;
  name: string;
  body: string;
  isStreaming: boolean;
}

interface Props {
  rows: SuggestionRowVM[];
  isDone: boolean;
  totalExpected: number | null;
}

export default function SuggestionStream({ rows, isDone, totalExpected }: Props) {
  const streamingCount = rows.reduce((n, r) => n + (r.isStreaming ? 1 : 0), 0);
  return (
    <div className="scan-suggestions">
      <div className="scan-suggestions-head">
        <div className="scan-suggestions-title">code suggestions</div>
        <div className="muted">{statusLine({ rows, isDone, totalExpected, streamingCount })}</div>
      </div>
      {rows.length === 0 && !isDone && (
        <div className="scan-empty">
          <span className="scan-progress-spinner" /> waiting for the model…
        </div>
      )}
      {rows.map((r) => (
        <SuggestionRow key={r.index} row={r} />
      ))}
    </div>
  );
}

function SuggestionRow({ row }: { row: SuggestionRowVM }) {
  const rowClass = row.isStreaming
    ? "scan-suggestion-row is-streaming"
    : "scan-suggestion-row";
  const sevColor = SEVERITY_COLORS[row.severity as Severity] ?? "#999";
  return (
    <div className={rowClass}>
      <div className="scan-suggestion-meta">
        <span className="scan-mini-badge" style={{ background: sevColor }}>
          {row.severity}
        </span>
        <strong>{row.name || "(unnamed)"}</strong>
        <span className="muted">· {row.kind.replace(/_/g, " ")}</span>
        <span className="muted">·</span>
        <code className="scan-code">{row.file}:{row.line}</code>
        <span className="muted" style={{ marginLeft: "auto" }}>
          {row.source.replace(/_/g, " ")}
        </span>
        {row.isStreaming && (
          <span
            className="scan-progress-spinner"
            aria-label="streaming"
            style={{ marginLeft: 6 }}
          />
        )}
      </div>
      <SuggestionBody body={row.body} streaming={row.isStreaming} />
    </div>
  );
}

/**
 * Decide between the prose render (no fence yet, or model gave no diff)
 * and the diff render (fence open). Single switch keeps the responsibility
 * here and lets DiffView stay pure.
 */
function SuggestionBody({ body, streaming }: { body: string; streaming: boolean }) {
  const parsed = useMemo(() => parseSuggestion(body), [body]);

  // Diff hasn't streamed in yet (or the model never opened a fence).
  // Show whatever rationale prose we have plus a trailing caret while
  // the model is still talking.
  if (!parsed.inDiff) {
    return (
      <div className="scan-suggestion-prose">
        {parsed.rationale || (streaming ? " " : "(no suggestion)")}
        {streaming && <span className="scan-suggestion-caret" aria-hidden />}
      </div>
    );
  }

  return (
    <>
      {parsed.rationale && (
        <div className="scan-suggestion-rationale">{parsed.rationale}</div>
      )}
      <DiffView
        lines={parsed.diffLines}
        streaming={streaming && !parsed.diffComplete}
      />
    </>
  );
}

function statusLine({
  rows,
  isDone,
  totalExpected,
  streamingCount,
}: {
  rows: SuggestionRowVM[];
  isDone: boolean;
  totalExpected: number | null;
  streamingCount: number;
}): string {
  if (isDone) {
    const n = rows.length;
    return `${n} suggestion${n === 1 ? "" : "s"}`;
  }
  if (streamingCount > 0) {
    return `streaming · ${rows.length} so far`;
  }
  if (totalExpected != null) {
    return `streaming · ${rows.length} of ~${totalExpected}`;
  }
  return `streaming · ${rows.length}`;
}
