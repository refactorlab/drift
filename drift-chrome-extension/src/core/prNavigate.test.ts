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
  estimateReadingMs,
  guideScrollThroughFile,
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

  it('navigateToPrFile injects a scroll-to-top for the EXACT file (anchor + path, no guided scroll yet)', async () => {
    mock.setActiveTab({ id: 7, url: 'https://github.com/refactorlab/drift/pull/80/changes' });
    await navigateToPrFile(PR, 'src/agents/iterative-agent.test.ts');
    const anchor = await diffAnchor('src/agents/iterative-agent.test.ts');
    const inject = mock.lastExecuteScript();
    expect(inject?.tabId).toBe(7);
    expect(typeof inject?.func).toBe('function'); // the in-page poll-and-scroll
    expect(inject?.args).toEqual([anchor, 'src/agents/iterative-agent.test.ts', DIFF_HEADER_OFFSET, 0]); // durationMs 0 = land at top
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
  beforeEach(() => {
    vi.useFakeTimers(); // the poll loop must not leak past the test
    document.body.innerHTML = '';
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('scrolls the file diff container to the top, below the sticky header (fixes "wrong file" + "at the bottom")', () => {
    const el = document.createElement('div');
    el.id = 'diff-abc';
    el.getBoundingClientRect = () => ({ top: 640 }) as DOMRect;
    document.body.appendChild(el);
    scrollToDiffInPage('diff-abc', 'src/app.ts', DIFF_HEADER_OFFSET, 0);
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 640 - DIFF_HEADER_OFFSET }));
  });

  it('auto-clicks a "Load Diff" placeholder inside the file (so the code is visible)', () => {
    const el = document.createElement('div');
    el.id = 'diff-big';
    el.getBoundingClientRect = () => ({ top: 200 }) as DOMRect;
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load Diff';
    const clicked = vi.fn();
    loadBtn.addEventListener('click', clicked);
    el.appendChild(loadBtn);
    document.body.appendChild(el);
    scrollToDiffInPage('diff-big', 'src/big.ts', DIFF_HEADER_OFFSET, 0);
    expect(clicked).toHaveBeenCalled(); // expanded the collapsed large diff
  });

  it('falls back to the diff header whose FULL path matches when the id is absent', () => {
    const container = document.createElement('div');
    container.id = 'diff-real';
    container.getBoundingClientRect = () => ({ top: 320 }) as DOMRect;
    const header = document.createElement('a');
    header.textContent = 'src/state/prFileStore.ts';
    container.appendChild(header);
    document.body.appendChild(container);
    scrollToDiffInPage('diff-MISSING', 'src/state/prFileStore.ts', DIFF_HEADER_OFFSET, 0);
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 320 - DIFF_HEADER_OFFSET }));
  });

  it('never scrolls to a sidebar entry (path text NOT inside a diff container)', () => {
    const sidebar = document.createElement('a');
    sidebar.textContent = 'src/state/prFileStore.ts'; // not within any [id^="diff-"]
    document.body.appendChild(sidebar);
    scrollToDiffInPage('diff-MISSING', 'src/state/prFileStore.ts', DIFF_HEADER_OFFSET, 0);
    expect(window.scrollTo).not.toHaveBeenCalled(); // nothing valid → polls (lazy render), no wrong scroll
  });
});

describe('estimateReadingMs (paces the guided scroll)', () => {
  it('scales with word count and the words-per-minute rate', () => {
    const text = Array.from({ length: 240 }, () => 'word').join(' '); // 240 words
    expect(estimateReadingMs(text, 240, 0, 600000)).toBe(60000); // ~1 min at 240 wpm
    expect(estimateReadingMs(text, 120, 0, 600000)).toBe(120000); // half the rate → twice as long
  });
  it('clamps to a sane range (never instant, never minutes by default)', () => {
    expect(estimateReadingMs('hi', 240)).toBe(1500); // floor
    expect(estimateReadingMs(Array.from({ length: 5000 }, () => 'w').join(' '), 240)).toBe(30000); // ceiling
  });
});

describe('guideScrollThroughFile', () => {
  let mock: ChromeMock;
  beforeEach(() => {
    mock = installChromeMock();
  });
  it('injects the scroller with the explanation-paced duration', async () => {
    mock.setActiveTab({ id: 3, url: 'https://github.com/refactorlab/drift/pull/80/files' });
    await guideScrollThroughFile('diff-abc', 'src/app.ts', 8000);
    expect(mock.lastExecuteScript()?.args).toEqual(['diff-abc', 'src/app.ts', DIFF_HEADER_OFFSET, 8000]);
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
