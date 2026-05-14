import type { PatchSections } from "./patch";

const EMPTY: PatchSections = {
  problem: "",
  fixLabel: "",
  originalStartLine: null,
  original: "",
  replacement: "",
  impact: "",
  complete: false,
};

/**
 * Pull the body of <TAG …>…</TAG> out of a partial buffer. The close tag may
 * not be there yet (the LLM is still streaming) — in that case we return
 * everything from after the open tag to the end of the buffer, so the UI
 * grows the section live as more tokens arrive.
 */
function pull(buffer: string, tag: string): string {
  const open = new RegExp(`<${tag}(?:\\s+[^>]*)?>`);
  const m = buffer.match(open);
  if (!m || m.index === undefined) return "";
  const bodyStart = m.index + m[0].length;
  const close = `</${tag}>`;
  const closeIdx = buffer.indexOf(close, bodyStart);
  const raw = closeIdx === -1 ? buffer.slice(bodyStart) : buffer.slice(bodyStart, closeIdx);
  return raw.replace(/^\n/, "").replace(/\n$/, "");
}

function pullStartLine(buffer: string): number | null {
  const m = buffer.match(/<ORIGINAL\s+start_line="(\d+)"\s*>/);
  return m ? Number(m[1]) : null;
}

export function extractSections(buffer: string): PatchSections {
  if (!buffer) return EMPTY;
  return {
    problem: pull(buffer, "PROBLEM"),
    fixLabel: pull(buffer, "FIX_LABEL"),
    originalStartLine: pullStartLine(buffer),
    original: pull(buffer, "ORIGINAL"),
    replacement: pull(buffer, "REPLACEMENT"),
    impact: pull(buffer, "IMPACT"),
    complete: buffer.includes("</IMPACT>"),
  };
}
