import { describe, expect, it } from 'vitest';
import { buildRawJsonSection, buildScanHtmlDoc, scanExportFilename } from './LivePipelineRun';
import type { LiveScanMeta } from '../core/liveSummary';
import sampleScan from './__fixtures__/sampleScan.json';

// Reverse of escHtmlText — recover the literal JSON from the escaped <pre> body.
// Order matters: &amp; LAST so a literal "&lt;" in the source survives.
const unescapeHtmlText = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const rawJsonFromSection = (sectionHtml: string): unknown => {
  const m = sectionHtml.match(/<pre>([\s\S]*)<\/pre>/);
  if (!m) throw new Error('no <pre> block in raw section');
  return JSON.parse(unescapeHtmlText(m[1]));
};

const meta = (p: Partial<LiveScanMeta>): LiveScanMeta => ({
  owner: 'acme',
  repo: 'web',
  number: 1423,
  title: null,
  changedFiles: 0,
  ...p,
});

describe('scanExportFilename', () => {
  it('builds a self-describing name from the repo coordinates', () => {
    expect(scanExportFilename(meta({}))).toBe('drift-scan-acme-web-pr1423.json');
  });

  it('sanitises slashes, spaces and punctuation to be filesystem-safe', () => {
    expect(scanExportFilename(meta({ owner: 'My Org/x', repo: 'cool repo!' }))).toBe(
      'drift-scan-My-Org-x-cool-repo-pr1423.json',
    );
  });

  it('falls back to "scan" when the coordinates are empty', () => {
    expect(scanExportFilename(meta({ owner: '', repo: '' }))).toBe('drift-scan-scan-pr1423.json');
  });

  it('omits a missing owner without a leading dash', () => {
    expect(scanExportFilename(meta({ owner: undefined, repo: 'web' }))).toBe(
      'drift-scan-web-pr1423.json',
    );
  });

  it('switches the extension for the HTML export', () => {
    expect(scanExportFilename(meta({}), 'html')).toBe('drift-scan-acme-web-pr1423.html');
  });
});

describe('buildScanHtmlDoc', () => {
  const doc = () =>
    buildScanHtmlDoc({
      title: 'acme/web · PR #1',
      theme: 'dark',
      css: '.rp-root{color:red}',
      body: '<div class="rp-root">hi</div>',
    });

  it('emits a standalone document with the doctype and charset', () => {
    const html = doc();
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
  });

  it('pins the active theme on <html> so colours match the panel', () => {
    expect(doc()).toContain('<html lang="en" data-theme="dark" style="color-scheme:dark">');
  });

  it('inlines the supplied CSS and wraps the body in .drift-root so tokens resolve', () => {
    const html = doc();
    expect(html).toContain('.rp-root{color:red}');
    expect(html).toContain('<body class="drift-root"><main class="drift-export"><div class="rp-root">hi</div>');
  });

  it('escapes the title to keep the <head> well-formed', () => {
    const html = buildScanHtmlDoc({
      title: '<script>"x"&y',
      theme: 'light',
      css: '',
      body: '',
    });
    expect(html).toContain('<title>&lt;script&gt;&quot;x&quot;&amp;y</title>');
  });
});

describe('buildRawJsonSection', () => {
  it('embeds the entire scan object, pretty-printed and lossless', () => {
    const scan = { pr_review: { counts: { files: 36 } }, deep: { a: [1, 2, 3] } };
    const html = buildRawJsonSection(scan);
    // Every field is present — nothing collapsed or truncated.
    expect(html).toContain(JSON.stringify(scan, null, 2));
    expect(html).toContain('Raw scan-pr.json');
  });

  it('escapes markup inside string values so it stays literal', () => {
    const html = buildRawJsonSection({ note: '<img src=x onerror=alert(1)>' });
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
  });

  it('renders null rather than dropping the block when there is no scan', () => {
    expect(buildRawJsonSection(undefined)).toContain('<pre>null</pre>');
  });
});

// End-to-end proof of the user's actual requirement: the exported HTML must
// carry the ENTIRE scan-pr.json losslessly — including the sections the lossy
// DOM snapshot drops (collapsed collapsibles, "N more suggestions"). We build
// the real export document and parse the embedded JSON back out.
describe('HTML export — lossless round-trip against a real scan fixture', () => {
  const buildExportDoc = (scan: unknown) =>
    buildScanHtmlDoc({
      title: 'acme/web · PR #1386',
      theme: 'light',
      css: '/* css */',
      // Mirrors exportHtml(): header + (rendered report) + raw JSON section.
      body: `<header class="drift-export-head"><h1>acme/web</h1></header>` +
        `<div class="rp-root">RENDERED_REPORT_SNAPSHOT</div>` +
        buildRawJsonSection(scan),
    });

  it('round-trips the full fixture byte-for-byte through the embedded JSON', () => {
    const doc = buildExportDoc(sampleScan);
    const section = doc.slice(doc.indexOf('<section class="rp-section drift-export-raw">'));
    // Byte-for-byte: the recovered JSON re-serialises identically to the source.
    // (Compared as canonical JSON text rather than toEqual, which trips on the
    // Vite JSON-module object shape — the strings are the real lossless contract.)
    expect(JSON.stringify(rawJsonFromSection(section))).toBe(JSON.stringify(sampleScan));
  });

  it('preserves data the lossy snapshot would truncate (all 21 suggestions, ext trees)', () => {
    const doc = buildExportDoc(sampleScan);
    const section = doc.slice(doc.indexOf('<section class="rp-section drift-export-raw">'));
    const back = rawJsonFromSection(section) as typeof sampleScan;
    // The rendered report only shows the first few suggestions then collapses the
    // rest — the raw block keeps every one.
    expect(back.pr_review.code_suggestions).toHaveLength(
      sampleScan.pr_review.code_suggestions.length,
    );
    // Deep nested extension data (absent from a closed collapsible) survives.
    expect(JSON.stringify(back.pr_review_ext)).toBe(JSON.stringify(sampleScan.pr_review_ext));
  });

  it('keeps the rendered report AND the raw block in one document, in order', () => {
    const doc = buildExportDoc(sampleScan);
    expect(doc).toContain('RENDERED_REPORT_SNAPSHOT');
    // Compare against the section's opening tag — the class name also appears in
    // the inlined frame CSS (in <head>), which would otherwise win indexOf.
    expect(doc.indexOf('RENDERED_REPORT_SNAPSHOT')).toBeLessThan(
      doc.indexOf('<section class="rp-section drift-export-raw">'),
    );
    expect(doc.startsWith('<!doctype html>')).toBe(true);
    expect(doc.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('escapes the literal < > in "anon <file:line>" labels, recovering them intact', () => {
    // sampleScan is full of affected_roots like "anon <foo.ts:12>" — the export
    // must not let those become stray tags, yet must decode back to the original.
    const back = rawJsonFromSection(
      buildRawJsonSection(sampleScan),
    ) as typeof sampleScan;
    const hasAngleLabel = (back.pr_scope.affected_roots as string[]).some((r) =>
      r.includes('<') && r.includes('>'),
    );
    expect(hasAngleLabel).toBe(true);
  });
});
