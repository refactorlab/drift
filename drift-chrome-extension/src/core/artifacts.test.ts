import { describe, it, expect, beforeEach } from 'vitest';
import { parseScanArtifacts, parsePrIdentity, parsePrContext } from './parse';

// The action renders the artifacts as a collapsed <details> with two <a>
// links; artifact ids 7241682200/7241682201 mirror the action's own tests.
const ARTIFACTS_HTML = `
<div class="comment-body markdown-body">
  <p><img alt="MERGE CONFIDENCE 0/5" src="g"></p>
  <details>
    <summary><sub>📎 Scan artifacts (JSON)</sub></summary>
    <sub><a href="https://github.com/o/r/actions/runs/9/artifacts/7241682200">pr-scan.json</a> ·
    <a href="https://github.com/o/r/actions/runs/9/artifacts/7241682201">pr-scan-context.json</a>
    — machine-readable scanner report + scan context. Sign in to GitHub to download.</sub>
  </details>
</div>`;

describe('parseScanArtifacts', () => {
  beforeEach(() => {
    document.body.innerHTML = ARTIFACTS_HTML;
  });

  it('reads both artifacts with consumer filenames and classifies them', () => {
    const arts = parseScanArtifacts(document.body);
    expect(arts.map((a) => a.name)).toEqual(['pr-scan.json', 'pr-scan-context.json']);
    expect(arts.map((a) => a.kind)).toEqual(['scan-report', 'scan-context']);
    expect(arts[0].url).toMatch(/7241682200$/);
    expect(arts[1].url).toMatch(/7241682201$/);
  });

  it('returns [] when there is no scan-artifacts accordion', () => {
    document.body.innerHTML =
      '<div class="comment-body"><a href="https://x/unrelated.json">unrelated.json</a></div>';
    expect(parseScanArtifacts(document.body)).toEqual([]);
  });
});

describe('parsePrIdentity / parsePrContext', () => {
  beforeEach(() => {
    document.body.innerHTML = ARTIFACTS_HTML;
    window.history.pushState({}, '', '/refactorlab/andy/pull/36');
    document.title = 'Refactor the renderer by ada · Pull Request #36 · refactorlab/andy';
  });

  it('derives owner/repo/number from the URL', () => {
    const pr = parsePrIdentity(document);
    expect(pr).toMatchObject({ owner: 'refactorlab', repo: 'andy', number: 36 });
    expect(pr?.url).toBe(`${window.location.origin}/refactorlab/andy/pull/36`);
  });

  it('assembles a PrContext with the report + artifacts', () => {
    const ctx = parsePrContext(document);
    expect(ctx).not.toBeNull();
    expect(ctx?.pr.number).toBe(36);
    expect(ctx?.report.found).toBe(true);
    expect(ctx?.artifacts).toHaveLength(2);
  });

  it('returns null when there is no Drift report on the page', () => {
    document.body.innerHTML = '<div class="comment-body">plain comment, no Drift</div>';
    expect(parsePrContext(document)).toBeNull();
  });

  it('still provides both files (url-less) when the comment has no artifacts accordion', () => {
    // Gauges present (report detected) but NO <details>📎 Scan artifacts.
    document.body.innerHTML =
      '<div class="comment-body markdown-body"><img alt="MERGE CONFIDENCE 2/5" src="g"></div>';
    window.history.pushState({}, '', '/o/r/pull/7');
    const ctx = parsePrContext(document);
    expect(ctx?.artifacts.map((a) => a.name)).toEqual(['pr-scan.json', 'pr-scan-context.json']);
    expect(ctx?.artifacts.every((a) => a.url === undefined)).toBe(true);
  });
});
