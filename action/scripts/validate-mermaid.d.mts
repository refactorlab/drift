// Type surface for the shared Mermaid validation gate (validate-mermaid.mjs).
// Hand-written because the script is plain ESM JS (it must be runnable by
// `node` directly from the Rust test suite, so it can't be a .ts file).

/** Result of validating a single diagram. `skipped` ⇒ validator not installed. */
export interface MermaidValidateResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

/** Validate one mermaid diagram string against the real mermaid parser. */
export function validate(diagram: string): Promise<MermaidValidateResult>;

/** Extract ```mermaid fenced blocks from a markdown string. */
export function extractBlocks(markdown: string): Promise<string[]>;

/** True when @zabaca/mermaid-validate is importable in this environment. */
export function isInstalled(): Promise<boolean>;
