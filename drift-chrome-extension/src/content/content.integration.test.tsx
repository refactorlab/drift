import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { marked } from 'marked';
import { installChromeMock } from '../test/chromeMock';
// The real Andy comment markdown, rendered the way GitHub renders it.
import comment from '../core/__fixtures__/andy-comment.md?raw';

// End-to-end-ish: set the rendered comment into the document, run the actual
// content script (content.tsx), and assert it detects the PR and mounts the
// Shadow-DOM lens — the exact path that had the "refresh doesn't detect" bug.

async function waitFor<T>(fn: () => T | null | undefined, ms = 2500): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error('timeout waiting for condition');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('content script — detection → Shadow-DOM lens (integration)', () => {
  beforeEach(() => {
    installChromeMock();
    window.history.pushState({}, '', '/refactorlab/drift/pull/70');
  });
  afterEach(() => {
    document.getElementById('drift-lens-host')?.remove();
    document.body.innerHTML = '';
  });

  it('mounts the lens launcher with the merge-confidence pill from the real comment', async () => {
    document.body.innerHTML = await marked.parse(comment);

    // Importing runs the content script's render() + watch() side effects.
    await import('./content');

    const host = await waitFor(() => document.getElementById('drift-lens-host'));
    const launcher = await waitFor(() =>
      host.shadowRoot?.querySelector<HTMLElement>('.drift-launcher'),
    );
    // The launcher shows the live merge confidence (e.g. "Merge 2/5"), proving
    // the script parsed the rendered comment and rendered the overlay.
    expect(launcher.textContent ?? '').toMatch(/Merge \d\/5|Drift/);
  });
});
