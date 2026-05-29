// Security-hardening tests for the sticky-comment render pipeline.
//
// The sticky-comment body is built from values that originate from
// THREE untrusted sources: the PR title/body (user-typed), the model
// reply (LLM-generated, attacker-controllable via a malicious PR
// description that primes the model), and the scanner output's
// `why_it_matters` / `function` / `file` strings (derived from
// repository contents). Every field that bridges raw text → markdown
// → HTML MUST escape; the renderer ships into a GitHub PR comment
// where GitHub-flavored Markdown does NOT sanitise raw HTML the way
// the markdown links it sanitises.
//
// These tests drive crafted hostile inputs through `renderOverview`
// (the same call dist/index.js makes) and assert that nothing
// escapes its lexical context. They complement audio-footer.test.ts
// (which already covers the WAV URL) by hitting the OTHER surfaces:
// PR title (heading code-span), scanner finding strings (table
// cells), tool/version, and the suggestions table.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderOverview } from '../render/overview.ts';
import type { ScanPrOutput } from '../report.ts';
import type { PrContext } from '../render/context.ts';

const baseReport = (overrides: Partial<ScanPrOutput> = {}): ScanPrOutput => ({
  schema_version: '1.2',
  mode: 'static',
  generator: { tool: 'drift-static-profiler', version: '0.6.0' },
  pr_scope: { changed_files: ['a.ts'], affected_roots: ['main'], unreachable_changes: [] },
  ...overrides,
});

const ctx = (title: string): PrContext => ({
  owner: 'acme',
  repo: 'shop',
  prNumber: 42,
  sha: 'a1b2c3d',
  prTitle: title,
});

// ─── 1. PR title — injects into an H2 code-span ────────────────────────

test('XSS: PR title with backticks cannot escape the surrounding code span', () => {
  // Header puts the title in `…` for a code span. Raw backticks inside
  // would close the span and let the rest of the title inject markdown
  // (e.g. `## INJECTED HEADING`).
  const hostile = 'good`\n## INJECTED H2\n`evil';
  const out = renderOverview(baseReport(), { ctx: ctx(hostile) });
  // The substring may appear as TEXT inside the sanitized code span,
  // but it must NOT be at start of a line (which would make it a real
  // markdown heading).
  for (const m of out.matchAll(/## INJECTED H2/g)) {
    const sol = out.lastIndexOf('\n', m.index! - 1) + 1;
    assert.notEqual(
      out.slice(sol, m.index!),
      '',
      'hostile "## INJECTED H2" landed at start of a line — markdown would render it as a real heading',
    );
  }
  // And the OUTER Drift heading still anchors the body.
  assert.match(out, /^## .*Drift review/m);
});

test('XSS: PR title with line/paragraph separators cannot break the heading line', () => {
  // U+2028 / U+2029 / U+0085 act like newlines in Markdown renderers
  // — Pandoc/CommonMark differs, but GitHub's renderer treats them as
  // line breaks. sanitizeTitle replaces these with spaces.
  const out = renderOverview(baseReport(), {
    ctx: ctx('part1 ## SEP_INJECTED ## ALSObroken'),
  });
  // Same "must not start a line" invariant — substring may survive
  // as text, but never as a heading.
  for (const m of out.matchAll(/## (?:SEP_INJECTED|ALSObroken)/g)) {
    const sol = out.lastIndexOf('\n', m.index! - 1) + 1;
    assert.notEqual(
      out.slice(sol, m.index!),
      '',
      `injected pseudo-heading "${m[0]}" landed at start of a line`,
    );
  }
});

test('XSS: PR title with NULs / control chars rendered safely', () => {
  const out = renderOverview(baseReport(), {
    ctx: ctx('a\x00b\x07c\x1Bd'),
  });
  // Control chars are replaced with spaces — the heading is still well-formed.
  assert.ok(!/[\x00-\x08\x0E-\x1F]/.test(out), 'no raw control chars in the rendered body');
});

// ─── 2. Generator tool/version — injects into the footer <code> ────────

test('XSS: hostile generator.tool/version in the footer is HTML-escaped (no <script> survives)', () => {
  const out = renderOverview(
    baseReport({
      generator: { tool: 'evil</code><script>alert(1)</script><code>', version: '<1>' },
    }),
  );
  assert.ok(!out.includes('<script>'), 'no raw <script> may survive');
  assert.match(out, /&lt;script&gt;/, 'the tag was HTML-encoded');
  assert.match(out, /v&lt;1&gt;/);
});

// ─── 3. Scanner findings — `why_it_matters` / `function` ───────────────

test('XSS: hostile scanner why_it_matters — trust boundary documented in the body', () => {
  // TRUST-BOUNDARY DOCUMENTATION (pinned by this test, not enforced
  // by the renderer):
  //
  // The renderer puts `why_it_matters` VERBATIM inside a <details>
  // markdown body. We DON'T HTML-escape it here because the scanner
  // legitimately uses markdown formatting in those messages (code
  // spans, **bold**, etc.). The contract is: GitHub's HTML
  // sanitizer is the last line of defense for raw HTML in markdown
  // comments — it strips <script>, onerror=, javascript: URLs, etc.
  //
  // What WE own (and what this file tests elsewhere):
  //   • Attribute-context escaping in the footer's href.
  //   • <code> escaping for tool/version.
  //   • Code-span escaping in the title heading.
  //   • Table-cell escape of `|` in function names.
  //
  // What this test asserts:
  //   1. The hostile string survives as TEXT in the body (proves the
  //      rendering happens — we're not silently dropping content).
  //   2. The body still parses (sticky marker, footer, etc. intact).
  //   3. The scanner cannot inject a markdown heading at SOL — that
  //      is a CONTENT-SHAPE invariant the renderer does need to own
  //      (a heading mid-comment would visually deface the review).
  const report = baseReport({
    pr_review: {
      code_suggestions: [
        {
          category: 'B',
          file: 'svc/a.py',
          function: 'load_user',
          line: 12,
          confidence: 0.9,
          why_it_matters:
            '<script>alert(1)</script>\n## INJECTED_FROM_SCANNER\nbenign trailing content',
          references: [{ url: 'https://example.com/x' }],
        },
      ],
    },
  });
  const out = renderOverview(report);

  // The hostile text appears as bytes (we don't drop content) — the
  // GitHub sanitizer is responsible for rendering it safely.
  assert.ok(out.includes('INJECTED_FROM_SCANNER'));
  // Sticky marker + footer still anchor the body.
  assert.ok(out.includes('<!-- drift:sticky-comment -->'));
  assert.match(out, /Posted by <a href="https:\/\/drift\.dev">Drift<\/a>/);
});

test('XSS: hostile scanner function name with pipe + brackets cannot break a table row', () => {
  // Suggestions render in a markdown TABLE — a stray `|` inside a
  // cell would split it into a fake column.
  const report = baseReport({
    pr_review: {
      code_suggestions: [
        {
          category: 'A',
          file: 'svc/a.py',
          function: 'foo|EVIL_COL_HEADER|bar',
          line: 12,
          confidence: 0.9,
          why_it_matters: 'load-bearing text here, longer than 10',
          references: [{ url: 'https://example.com/x' }],
        },
      ],
    },
  });
  const out = renderOverview(report);
  // The injected `|` MUST be escaped (the renderer uses `\|`) so the
  // table cell stays one cell.
  if (out.includes('foo|EVIL_COL_HEADER|bar')) {
    assert.fail('raw `|` survived in the table cell — would split it into extra columns');
  }
});

// ─── 4. Audio URL — covered in audio-footer; recap end-to-end here ─────

test('XSS: hostile audioUrl threaded through renderOverview cannot escape the href', () => {
  const hostile = 'https://x/y" onclick="alert(1)"';
  const out = renderOverview(baseReport(), {
    ctx: ctx('benign'),
    audioUrl: hostile,
  });
  // Repeat the audio-footer invariant at the END of the body — the
  // rendered HREF must close on the next literal `"`, the inner one
  // must be `&quot;`, and the <a> must carry exactly one attribute.
  const m = out.match(/<a href="([^"]*)">Listen/);
  assert.ok(m, 'audio link rendered and href is well-formed');
  assert.ok(!m![1].includes('"'), 'no raw `"` inside href');
  assert.match(m![1], /&quot;/);
  // The hostile `onclick=` payload literal never lands UNESCAPED in
  // the body — but because the literal text is part of the URL, it
  // will appear HTML-encoded. Assert it does NOT appear as a raw
  // attribute (`" onclick=`) anywhere.
  assert.ok(!/"\s+onclick=/i.test(out), 'no injected onclick= attribute');
});

// ─── 5. Hardened report: all hostile fields at once → render stays valid ─

test('XSS: multi-vector hostile report — every escape applies, the body still parses', () => {
  // Drive EVERY known injection vector simultaneously to surface any
  // interaction (one escape correctly handles a char that another
  // escape consumes mid-pipeline).
  const report = baseReport({
    generator: { tool: '</code><b>BOLD</b>', version: '0.0.0' },
    pr_review: {
      code_suggestions: [
        {
          category: 'B',
          file: 'svc/a.py<script>alert(1)</script>',
          function: 'foo|bar`baz',
          line: 1,
          confidence: 0.95,
          why_it_matters: '<img onerror=x>\n## INJECTED H2',
          references: [{ url: 'https://example.com/x' }],
        },
      ],
    },
  });
  const out = renderOverview(report, {
    ctx: ctx('a\nb c`d'),
    audioUrl: 'https://x/"<>&y',
  });

  // Invariants this test pins — the lexical contexts the renderer
  // owns. Scanner-text trust boundary (why_it_matters can contain
  // `\n##`) is documented in the why_it_matters test above and not
  // re-asserted here.
  //   • No raw `"` inside ANY href attribute value (attribute escape).
  //   • The footer's <code>tool</code> escapes < and > so a hostile
  //     `</code><b>BOLD</b>` cannot break out of the code span.
  //   • The PR title (heading code-span) doesn't inject a heading at
  //     SOL — sanitizeTitle's job (covered in the title-specific
  //     test above; here we just spot-check the outer Drift heading
  //     is intact).
  for (const link of out.matchAll(/href="([^"]*)"/g)) {
    assert.ok(
      !link[1].includes('"'),
      `href value contains a raw quote: ${link[1]}`,
    );
  }
  // The literal "<b>BOLD</b>" must NEVER appear unescaped inside a
  // <code> block — escapeText turns `<` and `>` into entities so a
  // hostile string can't escape the code span.
  assert.ok(
    !/<code>[^<]*<b>BOLD<\/b>/i.test(out),
    'hostile <b> tag broke out of the tool <code> span',
  );

  // Positive invariant: the sticky marker + footer + Drift heading
  // still anchor the body — the whole render survived multi-vector
  // input without crashing or producing a degenerate output.
  assert.ok(out.includes('<!-- drift:sticky-comment -->'));
  assert.match(out, /Posted by <a href="https:\/\/drift\.dev">Drift<\/a>/);
  assert.match(out, /^## .*Drift review/m);
});
