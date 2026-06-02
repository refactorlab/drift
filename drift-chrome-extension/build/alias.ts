// Shared module-resolution wiring used by BOTH vite.config.ts (the extension
// build) and vitest.config.ts (tests), so the renderer alias behaves
// identically in both.
//
// `@drift/render`  → the GitHub Action's PR-comment renderer, imported as the
//                    SINGLE SOURCE OF TRUTH. We bundle the real action source
//                    rather than forking it (see [[feedback_clean_architecture_per_language]]).
// `node:fs`        → a browser stub (the renderer's only Node touchpoint is
//                    report.ts#loadReport, which is dead code in the browser).
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// build/ → extension root → repo root
const repoRoot = resolve(here, '..', '..');
const actionRender = resolve(repoRoot, 'action/src/render/overview.ts');
const fsStub = resolve(here, '..', 'src/vendor/fs-stub.ts');

// Shared in BOTH build and tests: resolve the renderer + fixture to the action
// source (single source of truth).
export const driftAlias = [{ find: '@drift/render', replacement: actionRender }];

// BUILD-ONLY: stub `node:fs` so the renderer (whose report.ts has a dead
// `loadReport`/`readFileSync`) bundles for the browser. NOT used in Vitest —
// tests run in Node where the real `node:fs` is correct (and `loadReport` is
// simply never called). Exact-match only so we never shadow `node:fs/promises`.
export const fsStubAlias = [
  { find: /^node:fs$/, replacement: fsStub },
  { find: /^fs$/, replacement: fsStub },
];

// The renderer source lives OUTSIDE the extension package (../action). Vite's
// dev server sandboxes filesystem reads to the project root by default, so we
// must explicitly allow the repo root for both dev and bundling to reach it.
export const driftFsAllow = [repoRoot];
