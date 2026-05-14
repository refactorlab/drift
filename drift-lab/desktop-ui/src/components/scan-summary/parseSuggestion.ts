/**
 * Pure, partial-tolerant parser for the suggester's output format.
 *
 * The LLM emits, strictly:
 *   `Why: <one sentence rationale>`
 *   <blank line>
 *   ```diff
 *   @@ -34,7 +34,9 @@
 *    fn get_user(id: u64) -> User {
 *   -    let user = db.fetch(id);
 *   +    USER_CACHE.lock().get_or_insert(id)
 *    }
 *   ```
 *
 * The body grows token-by-token as the model streams. This parser runs on
 * *every accumulated body*, so any prefix of the contract must parse
 * cleanly:
 *
 *   1. `Why: ...` (no fence yet)                → rationale only, no diff
 *   2. `Why: ...\n\n` (about to open the fence) → rationale only, no diff
 *   3. `Why: ...\n\n\`\`\`diff\n@@ ...`         → rationale + open diff
 *   4. `Why: ...\n\n\`\`\`diff\n...\n\`\`\``   → rationale + closed diff
 *
 * The renderer uses {@link ParsedSuggestion.inDiff} and
 * {@link ParsedSuggestion.diffComplete} to decide where to put the
 * streaming caret (in the prose vs at the bottom of the diff).
 *
 * Robustness:
 *   - If the model omits the diff entirely, the whole body becomes
 *     `rationale` and the UI falls back to the prose render.
 *   - If the model picks a different fence language (e.g. ```rust), we
 *     deliberately *don't* match it — the prose fallback renders it raw
 *     instead of pretending it's a diff and miscoloring everything.
 */

export type DiffLineKind = "context" | "remove" | "add" | "hunk" | "meta";

export interface DiffLine {
  kind: DiffLineKind;
  /** Line text *with the prefix character stripped* — for diff lines a
   *  leading `+`/`-`/` ` is removed so the renderer can place the marker
   *  in its own gutter column. Hunk headers (`@@ ... @@`) and meta lines
   *  (`--- a/x.rs`, `+++ b/x.rs`) keep their full text. */
  text: string;
}

export interface ParsedSuggestion {
  /** Everything before the ```diff fence — the `Why:` line and any other
   *  prose the model wrote ahead of the diff. Trimmed. */
  rationale: string;
  /** Parsed diff lines, in order. Empty when no diff fence has streamed
   *  in yet. */
  diffLines: DiffLine[];
  /** True once we've seen the opening ```diff fence. */
  inDiff: boolean;
  /** True once we've seen the closing ``` fence after the diff content. */
  diffComplete: boolean;
}

// Allow optional whitespace + `diff` after the opening triple-backtick.
// Strict on the `diff` tag — we WON'T match ```rust or ```ts because those
// shouldn't be parsed as diffs (they'd render every line as "context" and
// silently mislead the user).
const DIFF_FENCE_OPEN = /```\s*diff\s*\r?\n/;
const FENCE_CLOSE_AT_LINE_START = /\r?\n```/;

export function parseSuggestion(body: string): ParsedSuggestion {
  const openMatch = body.match(DIFF_FENCE_OPEN);
  if (!openMatch || openMatch.index === undefined) {
    return {
      rationale: body.trim(),
      diffLines: [],
      inDiff: false,
      diffComplete: false,
    };
  }
  const rationale = body.slice(0, openMatch.index).trim();
  const afterFence = body.slice(openMatch.index + openMatch[0].length);

  const closeMatch = afterFence.match(FENCE_CLOSE_AT_LINE_START);
  const diffContent =
    closeMatch && closeMatch.index !== undefined
      ? afterFence.slice(0, closeMatch.index)
      : afterFence;

  return {
    rationale,
    diffLines: classifyDiff(diffContent),
    inDiff: true,
    diffComplete: closeMatch !== null,
  };
}

function classifyDiff(content: string): DiffLine[] {
  if (content.length === 0) return [];
  // Drop a trailing empty line that comes from a final newline before the
  // closing fence — it would render as a blank "context" row otherwise.
  const lines = content.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.map(classify);
}

function classify(line: string): DiffLine {
  if (line.startsWith("@@")) return { kind: "hunk", text: line };
  if (line.startsWith("+++") || line.startsWith("---")) {
    return { kind: "meta", text: line };
  }
  if (line.startsWith("+")) return { kind: "add", text: line.slice(1) };
  if (line.startsWith("-")) return { kind: "remove", text: line.slice(1) };
  // Context: most diffs prefix with a single space. Strip exactly one if
  // present; some models drop it on whitespace-only lines, so we keep
  // those untouched.
  if (line.startsWith(" ")) return { kind: "context", text: line.slice(1) };
  return { kind: "context", text: line };
}
