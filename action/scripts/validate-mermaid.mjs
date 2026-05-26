// Single source of truth for Mermaid validation across this repo.
//
// WHY: our diagrams are string-built in Rust (drift-static-profiler) and
// framed verbatim by the action. A typed builder alone is NOT bulletproof —
// it still concatenates strings and can emit syntax the renderer rejects
// (e.g. an unquoted `<lambda@21>` label, which GitHub's mermaid tokenizes
// `@` as a LINK_ID and aborts the parse). The only bulletproof guard is to
// run candidate diagrams through the *real* mermaid parser. This module is
// that gate, called from BOTH:
//   • the action's TS tests          (import { validate } from this file)
//   • the Rust scanner tests         (node action/scripts/validate-mermaid.mjs <file>)
// so "valid" means exactly the same thing on both sides.
//
// VALIDATOR: the official `mermaid` parser (the same jison flowchart grammar
// GitHub renders with — pinned to v11 in package.json) driven under `jsdom`
// for the minimal DOM mermaid needs at parse time. We use mermaid directly
// rather than a wrapper package: @zabaca/mermaid-validate ships CLI-only and
// Bun-targeted, and the Langium `@mermaid-js/parser` doesn't cover flowchart.
// Raw `mermaid.parse()` in *bare* Node returns false (mermaid-js/mermaid#6370),
// hence the jsdom shim. These are devDependencies — never imported by the
// action runtime (src/index.ts et al.), so the shipped dist/ bundles stay
// clean and the scan pipeline in action.yml does not depend on them.
//
// OFFLINE / NOT-YET-INSTALLED: until `mermaid` + `jsdom` are installed
// (`cd action && npm i -D mermaid@11 jsdom`), validate() returns
// { ok: true, skipped: true } and the CLI exits 2. That keeps every suite
// green before the deps land and makes the gate activate automatically once
// they do — no test edits required.

import { readFileSync } from 'node:fs';

let _parse = null; // bound mermaid.parse, or null when deps are unavailable
let _initDone = false;

async function init() {
  if (_initDone) return;
  _initDone = true;
  try {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      pretendToBeVisual: true,
    });
    // mermaid (and its bundled DOMPurify) read these globals at import/init
    // time, so they must exist BEFORE `import('mermaid')`.
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    // Node may already expose a read-only `navigator`; only fill it if absent.
    if (typeof globalThis.navigator === 'undefined') {
      globalThis.navigator = dom.window.navigator;
    }
    const mermaid = (await import('mermaid')).default;
    // securityLevel:'loose' disables label sanitisation that could otherwise
    // mask a genuine syntax problem; startOnLoad:false keeps it headless.
    mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
    _parse = (text) => mermaid.parse(text); // resolves on valid, throws on invalid
  } catch {
    _parse = null;
  }
}

/** True when the mermaid+jsdom validator deps are importable here. */
export async function isInstalled() {
  await init();
  return _parse != null;
}

/**
 * Validate a single mermaid diagram string against the real mermaid parser.
 * @returns {Promise<{ok: boolean, skipped?: boolean, error?: string}>}
 *   - { ok: true, skipped: true } when the deps aren't installed.
 *   - { ok: false, error } when mermaid rejects the diagram.
 */
export async function validate(diagram) {
  await init();
  if (!_parse) return { ok: true, skipped: true, error: 'validator-not-installed' };
  try {
    // mermaid.parse resolves to a truthy { diagramType } when valid and
    // throws (or resolves false) when not.
    const res = await _parse(diagram);
    return { ok: res !== false };
  } catch (e) {
    const msg = String(e?.message ?? e).split('\n').slice(0, 4).join('\n');
    return { ok: false, error: msg };
  }
}

/** Extract ```mermaid fenced blocks from a markdown string. */
export async function extractBlocks(markdown) {
  const blocks = [];
  const re = /```mermaid\s*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(markdown)) !== null) blocks.push(m[1]);
  return blocks;
}

// ── CLI ──────────────────────────────────────────────────────────────────
// Usage:
//   node validate-mermaid.mjs <file.mmd> [<file2.mmd> ...]   # each = 1 diagram
//   node validate-mermaid.mjs --markdown <file.md> ...       # extract + validate
//   node validate-mermaid.mjs --stdin                        # 1 diagram on stdin
// Exit codes: 0 all valid · 1 at least one invalid · 2 deps not installed.
async function main(argv) {
  if (!(await isInstalled())) {
    console.error('⏭️  mermaid validator not installed — skipping. ' +
      'Activate with: (cd action && npm i -D mermaid@11 jsdom)');
    return 2;
  }

  const args = argv.slice(2);
  /** @type {{name: string, text: string}[]} */
  const diagrams = [];

  if (args.includes('--stdin')) {
    diagrams.push({ name: '<stdin>', text: readFileSync(0, 'utf8') });
  } else {
    let markdownMode = false;
    for (const a of args) {
      if (a === '--markdown') { markdownMode = true; continue; }
      const raw = readFileSync(a, 'utf8');
      if (markdownMode || a.endsWith('.md')) {
        const blocks = await extractBlocks(raw);
        blocks.forEach((b, i) => diagrams.push({ name: `${a}#mermaid[${i}]`, text: b }));
      } else {
        diagrams.push({ name: a, text: raw });
      }
    }
  }

  if (diagrams.length === 0) {
    console.error('no diagrams to validate (pass files, --markdown <f>, or --stdin)');
    return 1;
  }

  let failed = 0;
  for (const d of diagrams) {
    const r = await validate(d.text);
    if (r.ok) {
      console.log(`✅ ${d.name}`);
    } else {
      failed++;
      console.error(`❌ ${d.name}\n   ${r.error ?? 'invalid mermaid'}`);
    }
  }
  console.error(`\n${diagrams.length - failed}/${diagrams.length} diagram(s) valid`);
  return failed === 0 ? 0 : 1;
}

// Run as CLI only when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv).then((code) => process.exit(code));
}
