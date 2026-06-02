// Browser stub for `node:fs`.
//
// The PR-comment renderer is imported verbatim from the GitHub Action's
// `action/src/render/` (the single source of truth — see [[project_pr_comment_renderer]]).
// That tree pulls in `action/src/report.ts` for `passesQualityBar`, and
// report.ts also defines `loadReport()`, which does `readFileSync(...)`.
//
// In the extension we ALWAYS hand the renderer an already-parsed object (the
// scan JSON came over the network / out of the WASM scanner), so `loadReport`
// is dead code here. Aliasing `node:fs` to this stub lets Vite/esbuild bundle
// the real renderer without touching the action — and if anything ever did try
// to read a file in the browser, it fails loudly instead of silently.
export function readFileSync(): never {
  throw new Error('node:fs is not available in the browser (drift-chrome-extension stub)');
}

export default { readFileSync };
