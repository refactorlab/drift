// Wire types — must stay in sync with src-tauri/src/patch/types.rs.
// The Rust enum uses #[serde(tag = "type", rename_all = "camelCase")],
// so every variant arrives as { type: "...", ...fields }.

export type PatchEvent =
  | { type: "started"; requestId: string }
  | { type: "delta"; text: string }
  | { type: "done"; fullText: string }
  | { type: "error"; message: string };

export interface PatchSections {
  problem: string;
  fixLabel: string;
  originalStartLine: number | null;
  original: string;
  replacement: string;
  impact: string;
  /** True once the full </IMPACT> close tag has been seen. */
  complete: boolean;
}

export interface ApplyItem {
  kind: string;
  filePath: string;
  success: boolean;
  message: string | null;
}

export interface ApplyResult {
  ok: boolean;
  items: ApplyItem[];
}
