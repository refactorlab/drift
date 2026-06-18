import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { installChromeMock, type ChromeMock } from '../test/chromeMock';
import {
  diffAnchor,
  attachAnchors,
  parsePrLocation,
  prDiffRoute,
  buildPrChangesUrl,
  buildPrFileUrl,
  navigateToPrChanges,
  navigateToPrFile,
  locateActiveTab,
  diffScrollTop,
  scrollToDiffInPage,
  runScrollPlanInPage,
  runScrollPlanThroughFile,
  DIFF_HEADER_OFFSET,
} from './prNavigate';
import type { PrId } from './prRefs';

const PR: PrId = { owner: 'refactorlab', repo: 'drift', number: 80, host: 'github.com' };
const ENTERPRISE: PrId = { owner: 'my-org', repo: 'svc', number: 12, host: 'github.acme.com' };

describe('diffAnchor', () => {
  it('is `diff-` + the hex SHA-256 of the path (matches GitHub)', async () => {
    const path = 'src/core/prNavigate.ts';
    const expected = `diff-${createHash('sha256').update(path).digest('hex')}`;
    expect(await diffAnchor(path)).toBe(expected);
  });

  it('is deterministic and path-sensitive', async () => {
    expect(await diffAnchor('a.ts')).toBe(await diffAnchor('a.ts'));
    expect(await diffAnchor('a.ts')).not.toBe(await diffAnchor('b.ts'));
  });

  it('attachAnchors fills each step with its anchor', async () => {
    const out = await attachAnchors([{ path: 'a.ts' }, { path: 'b.ts' }]);
    expect(out[0].anchor).toBe(await diffAnchor('a.ts'));
    expect(out[1].anchor).toBe(await diffAnchor('b.ts'));
  });
});

describe('parsePrLocation', () => {
  it('reads the PR sub-page', () => {
    expect(parsePrLocation('https://github.com/o/r/pull/5/files').section).toBe('files');
    expect(parsePrLocation('https://github.com/o/r/pull/5/changes').section).toBe('changes');
    expect(parsePrLocation('https://github.com/o/r/pull/5/commits').section).toBe('commits');
    expect(parsePrLocation('https://github.com/o/r/pull/5').section).toBe('conversation');
    expect(parsePrLocation('https://github.com/o/r/tree/main').section).toBe('other');
    expect(parsePrLocation(undefined).section).toBe('other');
    expect(parsePrLocation('not a url').section).toBe('other');
  });

  it('extracts the diff anchor from the hash', () => {
    const anchor = 'diff-bc6c77f1b3cc0805f73156836ca5d34446e6d317deb872a1d3dcb2c1e68ba80d';
    expect(parsePrLocation(`https://github.com/o/r/pull/5/changes#${anchor}`).anchor).toBe(anchor);
    expect(parsePrLocation('https://github.com/o/r/pull/5/files').anchor).toBeNull();
    expect(parsePrLocation('https://github.com/o/r/pull/5/files#L10').anchor).toBeNull();
  });

  it('parses the PR identity (incl. enterprise host)', () => {
    expect(parsePrLocation('https://github.acme.com/my-org/svc/pull/12/files').id).toEqual(ENTERPRISE);
  });
});

describe('prDiffRoute (auto-detect)', () => {
  it('reuses /changes, else defaults to /files', () => {
    expect(prDiffRoute('https://github.com/o/r/pull/5/changes')).toBe('changes');
    expect(prDiffRoute('https://github.com/o/r/pull/5/files')).toBe('files');
    expect(prDiffRoute('https://github.com/o/r/pull/5')).toBe('files'); // conversation → files
    expect(prDiffRoute(undefined)).toBe('files');
  });
});

describe('URL builders', () => {
  it('builds changes + file URLs for github.com and enterprise', () => {
    expect(buildPrChangesUrl(PR, 'files')).toBe('https://github.com/refactorlab/drift/pull/80/files');
    expect(buildPrChangesUrl(ENTERPRISE, 'changes')).toBe('https://github.acme.com/my-org/svc/pull/12/changes');
    expect(buildPrFileUrl(PR, 'files', 'diff-abc')).toBe('https://github.com/refactorlab/drift/pull/80/files#diff-abc');
  });
});

describe('navigation (drives the active tab)', () => {
  let mock: ChromeMock;
  beforeEach(() => {
    mock = installChromeMock();
  });

  it('navigateToPrChanges updates the active tab, auto-detecting the route', async () => {
    mock.setActiveTab({ id: 7, url: 'https://github.com/refactorlab/drift/pull/80/changes' });
    const res = await navigateToPrChanges(PR);
    expect(res.ok).toBe(true);
    expect(res.url).toBe('https://github.com/refactorlab/drift/pull/80/changes');
    expect(mock.lastTabUpdate()).toEqual({ tabId: 7, props: { url: res.url } });
  });

  it('navigateToPrFile navigates to the file anchor on the current route', async () => {
    mock.setActiveTab({ id: 7, url: 'https://github.com/refactorlab/drift/pull/80/files' });
    const res = await navigateToPrFile(PR, 'src/app.ts');
    const anchor = await diffAnchor('src/app.ts');
    expect(res.url).toBe(`https://github.com/refactorlab/drift/pull/80/files#${anchor}`);
    expect(mock.lastTabUpdate()?.props.url).toBe(res.url);
  });

  it('navigateToPrFile injects a scroll-to-top for the EXACT file (anchor + path)', async () => {
    mock.setActiveTab({ id: 7, url: 'https://github.com/refactorlab/drift/pull/80/changes' });
    await navigateToPrFile(PR, 'src/agents/iterative-agent.test.ts');
    const anchor = await diffAnchor('src/agents/iterative-agent.test.ts');
    const inject = mock.lastExecuteScript();
    expect(inject?.tabId).toBe(7);
    expect(typeof inject?.func).toBe('function'); // the in-page poll-and-scroll-to-top
    expect(inject?.args).toEqual([anchor, 'src/agents/iterative-agent.test.ts', DIFF_HEADER_OFFSET]);
  });

  it('does not inject a scroll when there is no tab to drive', async () => {
    mock.setActiveTab(undefined);
    const res = await navigateToPrFile(PR, 'src/app.ts');
    expect(res.ok).toBe(false);
    expect(mock.lastExecuteScript()).toBeNull();
  });

  it('uses a precomputed anchor when given (no re-hash)', async () => {
    mock.setActiveTab({ id: 7, url: 'https://github.com/refactorlab/drift/pull/80/changes' });
    const res = await navigateToPrFile(PR, 'whatever', { anchorId: 'diff-precomputed' });
    expect(res.url).toBe('https://github.com/refactorlab/drift/pull/80/changes#diff-precomputed');
  });

  it('fails with a relayed reason when there is no tab to drive', async () => {
    mock.setActiveTab(undefined);
    const res = await navigateToPrChanges(PR);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/no active browser tab/);
    expect(mock.lastTabUpdate()).toBeNull();
  });
});

describe('diffScrollTop', () => {
  it('puts the element top below the sticky header, clamped at 0', () => {
    expect(diffScrollTop(500, 0)).toBe(500 - DIFF_HEADER_OFFSET); // element 500px down, page at top
    expect(diffScrollTop(200, 1000)).toBe(1200 - DIFF_HEADER_OFFSET); // accounts for current scroll
    expect(diffScrollTop(10, 0)).toBe(0); // never negative
  });
});

describe('scrollToDiffInPage (the injected in-page scroller)', () => {
  let scrolled: Element[];
  let reload: ReturnType<typeof vi.fn>;
  const ORIGINAL_LOCATION = window.location;
  beforeEach(() => {
    vi.useFakeTimers(); // the poll loop must not leak past the test
    document.body.innerHTML = '';
    // jsdom doesn't implement scrollIntoView — record which element it's called on so
    // we can assert the RIGHT file container is the scroll target (not a neighbour).
    scrolled = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    } as unknown as typeof Element.prototype.scrollIntoView;
    // jsdom's location.reload is non-configurable (can't spyOn it) — replace the whole
    // location with a URL-backed stub so the "virtualised, no tree row" reload fallback
    // is observable (and silent, no "Not implemented: navigation" noise).
    reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: Object.assign(new URL(ORIGINAL_LOCATION.href), { reload, assign: vi.fn(), replace: vi.fn() }),
    });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    Object.defineProperty(window, 'location', { configurable: true, value: ORIGINAL_LOCATION });
  });

  it('scrolls the EXACT file container into view (layout-robust → never a neighbour)', () => {
    const el = document.createElement('div');
    el.id = 'diff-abc';
    document.body.appendChild(el);
    scrollToDiffInPage('diff-abc', 'src/app.ts', DIFF_HEADER_OFFSET);
    expect(scrolled).toContain(el); // scrolled THIS container into view
    expect(reload).not.toHaveBeenCalled(); // it was rendered → no fallback
  });

  it('auto-clicks a "Load Diff" placeholder inside the file (so the code is visible)', () => {
    const el = document.createElement('div');
    el.id = 'diff-big';
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load Diff';
    const clicked = vi.fn();
    loadBtn.addEventListener('click', clicked);
    el.appendChild(loadBtn);
    document.body.appendChild(el);
    scrollToDiffInPage('diff-big', 'src/big.ts', DIFF_HEADER_OFFSET);
    expect(clicked).toHaveBeenCalled(); // expanded the collapsed large diff
  });

  it('falls back to the diff header whose FULL path matches when the id is absent', () => {
    const container = document.createElement('div');
    container.id = 'diff-real';
    const header = document.createElement('a');
    header.textContent = 'src/state/prFileStore.ts';
    container.appendChild(header);
    document.body.appendChild(container);
    scrollToDiffInPage('diff-MISSING', 'src/state/prFileStore.ts', DIFF_HEADER_OFFSET);
    expect(scrolled).toContain(container); // climbed to the matching file container
  });

  // VIRTUALISATION: an off-screen file in a big PR isn't in the DOM at all, so the hash
  // + scrollIntoView can't reach it (the "next left the page on the previous file" bug).
  // The always-present file-TREE row links to the same anchor — click it to drive
  // GitHub's own render+scroll.
  it("clicks the file-tree row (href→anchor) for a not-yet-rendered file, doesn't reload", () => {
    const treeRow = document.createElement('a');
    treeRow.setAttribute('href', '/o/r/pull/1/files#diff-faraway');
    treeRow.textContent = 'voicePrompt.ts';
    const clicked = vi.fn();
    treeRow.addEventListener('click', (e) => {
      e.preventDefault();
      clicked();
    });
    document.body.appendChild(treeRow);
    scrollToDiffInPage('diff-faraway', 'src/core/voicePrompt.ts', DIFF_HEADER_OFFSET);
    expect(clicked).toHaveBeenCalled(); // drove GitHub's own navigation
    expect(reload).not.toHaveBeenCalled(); // a tree row existed → no reload needed
    expect(scrolled).toHaveLength(0); // container not in DOM yet → nothing wrongly scrolled
  });

  it('clicks the file-tree row matched by FULL-PATH title when there is no anchor href', () => {
    const treeRow = document.createElement('a');
    treeRow.setAttribute('title', 'src/core/voicePrompt.ts');
    const clicked = vi.fn();
    treeRow.addEventListener('click', (e) => {
      e.preventDefault();
      clicked();
    });
    document.body.appendChild(treeRow);
    scrollToDiffInPage('diff-faraway', 'src/core/voicePrompt.ts', DIFF_HEADER_OFFSET);
    expect(clicked).toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('lands on the container once the tree-click renders it in (poll → scrollIntoView)', () => {
    const treeRow = document.createElement('a');
    treeRow.setAttribute('href', '#diff-faraway');
    treeRow.addEventListener('click', (e) => e.preventDefault());
    document.body.appendChild(treeRow);
    scrollToDiffInPage('diff-faraway', 'src/core/voicePrompt.ts', DIFF_HEADER_OFFSET);
    expect(scrolled).toHaveLength(0); // not rendered yet
    // GitHub renders the file in after the tree click → the poll finds + scrolls it.
    const container = document.createElement('div');
    container.id = 'diff-faraway';
    document.body.appendChild(container);
    vi.advanceTimersByTime(300); // one poll tick
    expect(scrolled).toContain(container);
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads to deep-link when the file is virtualised out AND no tree row exists', () => {
    // A stray text match that is NOT a clickable tree row (no href/title/role) and not in
    // a diff container → must NOT scroll to it; with no way to navigate in-page, reload to
    // re-trigger GitHub's on-load hash handler (which renders+scrolls to the anchor).
    const stray = document.createElement('span');
    stray.textContent = 'src/state/prFileStore.ts';
    document.body.appendChild(stray);
    scrollToDiffInPage('diff-MISSING', 'src/state/prFileStore.ts', DIFF_HEADER_OFFSET);
    expect(scrolled).toHaveLength(0); // never scrolled to the stray match
    expect(reload).toHaveBeenCalled(); // deep-link fallback
  });
});

describe('runScrollPlanInPage (the injected dwell-scroll executor)', () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers(); // bound the dwell setTimeout loop
    document.body.innerHTML = '';
    // jsdom doesn't implement scrollIntoView — mock it so we can assert the target.
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('expands "Load Diff", HIGHLIGHTS the range, and scrolls the line cell into view', () => {
    const container = document.createElement('div');
    container.id = 'diff-x';
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load Diff';
    const clicked = vi.fn();
    loadBtn.addEventListener('click', clicked);
    container.appendChild(loadBtn);
    const row = document.createElement('div');
    row.setAttribute('role', 'row');
    const cell = document.createElement('div');
    cell.setAttribute('data-line-number', '20');
    row.appendChild(cell);
    container.appendChild(row);
    document.body.appendChild(container);

    const plan = [{ startLine: 20, endLine: 22, dwellMs: 3000 }];
    expect(() => runScrollPlanInPage('diff-x', 'src/x.ts', DIFF_HEADER_OFFSET, plan, 0)).not.toThrow();
    expect(clicked).toHaveBeenCalled(); // expanded the collapsed diff
    // The first step runs synchronously (startDelay 0) → highlight + scrollIntoView.
    expect(row.classList.contains('drift-present-hl')).toBe(true);
    expect(scrollIntoView).toHaveBeenCalled(); // scrolled the line cell (scoped to THIS container) into view
    expect(document.getElementById('drift-present-style')).not.toBeNull();
  });

  it('emphasises the SYMBOL NAME sub-line (wraps it in a .drift-present-name span)', () => {
    const container = document.createElement('div');
    container.id = 'diff-y';
    const row = document.createElement('div');
    row.setAttribute('role', 'row');
    const cell = document.createElement('div');
    cell.setAttribute('data-line-number', '42');
    const code = document.createElement('span');
    code.textContent = '  const pushMic = (frame) => {'; // the line text containing the symbol
    row.append(cell, code);
    container.appendChild(row);
    document.body.appendChild(container);

    const plan = [{ startLine: 42, endLine: 42, dwellMs: 3000, name: 'pushMic' }];
    runScrollPlanInPage('diff-y', 'src/v.ts', DIFF_HEADER_OFFSET, plan, 0);
    const mark = document.querySelector('.drift-present-name');
    expect(mark?.textContent).toBe('pushMic'); // just the name, wrapped within the line
  });

  it('OVERVIEW sweep beat scrolls to the file TOP, then advances to the first change beat', () => {
    const container = document.createElement('div');
    container.id = 'diff-sweep';
    const row = document.createElement('div');
    row.setAttribute('role', 'row');
    const cell = document.createElement('div');
    cell.setAttribute('data-line-number', '2'); // the first change
    row.appendChild(cell);
    container.appendChild(row);
    document.body.appendChild(container);

    // beat 0 = overview sweep (top → line 2); beat 1 = the change at line 2.
    const plan = [
      { startLine: 1, endLine: 2, dwellMs: 3000, sweep: true },
      { startLine: 2, endLine: 2, dwellMs: 1500 },
    ];
    expect(() => runScrollPlanInPage('diff-sweep', 'src/s.ts', DIFF_HEADER_OFFSET, plan, 0)).not.toThrow();
    // The sweep first scrolls the file container to the TOP (block:start), no row highlight yet.
    expect(scrollIntoView).toHaveBeenCalled();
    expect(row.classList.contains('drift-present-hl')).toBe(false);
    // After the overview dwell, it advances to the first change and highlights it.
    vi.advanceTimersByTime(3000);
    expect(row.classList.contains('drift-present-hl')).toBe(true);
  });

  it('drives the file-tree row when the file is not yet rendered, then runs once it mounts', () => {
    const treeRow = document.createElement('a');
    treeRow.setAttribute('href', '#diff-late');
    const clicked = vi.fn();
    treeRow.addEventListener('click', (e) => {
      e.preventDefault();
      clicked();
    });
    document.body.appendChild(treeRow);

    const plan = [{ startLine: 5, endLine: 5, dwellMs: 1500 }];
    runScrollPlanInPage('diff-late', 'src/late.ts', DIFF_HEADER_OFFSET, plan, 0);
    expect(clicked).toHaveBeenCalled(); // not in DOM → clicked the tree row to render it
    expect(scrollIntoView).not.toHaveBeenCalled(); // nothing to scroll yet

    // GitHub renders the file in → the poll picks it up and runs the dwell plan.
    const container = document.createElement('div');
    container.id = 'diff-late';
    const row = document.createElement('div');
    row.setAttribute('role', 'row');
    const cell = document.createElement('div');
    cell.setAttribute('data-line-number', '5');
    row.appendChild(cell);
    container.appendChild(row);
    document.body.appendChild(container);
    vi.advanceTimersByTime(300); // one poll tick
    expect(scrollIntoView).toHaveBeenCalled(); // ran the plan on the now-rendered file
    expect(row.classList.contains('drift-present-hl')).toBe(true);
  });
});

describe('runScrollPlanThroughFile', () => {
  let mock: ChromeMock;
  beforeEach(() => {
    mock = installChromeMock();
  });
  it('injects the executor with the plan + a voice lead delay', async () => {
    mock.setActiveTab({ id: 3, url: 'https://github.com/refactorlab/drift/pull/80/files' });
    const plan = [{ startLine: 10, endLine: 20, dwellMs: 5000 }];
    await runScrollPlanThroughFile('diff-abc', 'src/app.ts', plan, 'voice');
    expect(mock.lastExecuteScript()?.args).toEqual(['diff-abc', 'src/app.ts', DIFF_HEADER_OFFSET, plan, 700]);
  });
  it('does nothing for an empty plan', async () => {
    mock.setActiveTab({ id: 3, url: 'https://github.com/refactorlab/drift/pull/80/files' });
    await runScrollPlanThroughFile('diff-abc', 'src/app.ts', [], 'text');
    expect(mock.lastExecuteScript()).toBeNull();
  });
});

describe('locateActiveTab', () => {
  let mock: ChromeMock;
  beforeEach(() => {
    mock = installChromeMock();
  });

  it('reports being on the PR changes page + the viewed file anchor', async () => {
    const anchor = await diffAnchor('src/app.ts');
    mock.setActiveTab({ id: 1, url: `https://github.com/refactorlab/drift/pull/80/files#${anchor}` });
    const loc = await locateActiveTab(PR);
    expect(loc.onThisPr).toBe(true);
    expect(loc.onChangesPage).toBe(true);
    expect(loc.section).toBe('files');
    expect(loc.anchor).toBe(anchor);
  });

  it('reports a different PR / page as not-on-this-PR', async () => {
    mock.setActiveTab({ id: 1, url: 'https://github.com/refactorlab/drift/pull/99' });
    const loc = await locateActiveTab(PR);
    expect(loc.onThisPr).toBe(false);
    expect(loc.onChangesPage).toBe(false);
  });
});
