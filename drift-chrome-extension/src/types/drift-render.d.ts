// Type surface for the `@drift/render` alias (the GitHub Action's PR-comment
// renderer, bundled as the single source of truth).
//
// We deliberately declare a THIN, stable contract here instead of letting the
// extension's `tsc` follow the import into the action source — the action tree
// is compiled under its own (looser) tsconfig and would trip this package's
// stricter flags (verbatimModuleSyntax, noUnusedLocals). Vite/Vitest resolve
// the alias to the real `.ts` for bundling; `tsc` only ever sees this shim.
//
// The renderer's input is the scanner's `ScanPrOutput` JSON. It's dynamic data
// crossing a process boundary, so `unknown` is the honest type here — callers
// validate shape at runtime (see core/scanReport.ts).
declare module '@drift/render' {
  /** Leading HTML marker that must be the first line of the sticky comment. */
  export const STICKY_MARKER: string;

  export type DriftRenderCtx = {
    owner?: string;
    repo?: string;
    sha?: string;
    prTitle?: string;
  };

  export type DriftRenderOptions = {
    ctx?: DriftRenderCtx;
    priorState?: { v: number; confHistory?: number[] } | null;
    audioUrl?: string;
    scanJsonUrl?: string;
    scanContextUrl?: string;
    maxSuggestions?: number;
  };

  /** Renders the full sticky PR-comment markdown body from a scan-pr report. */
  export function renderOverview(report: unknown, opts?: DriftRenderOptions): string;
}
