import { describe, it, expect } from 'vitest';
import {
  parsePrRefs,
  refsAreUsable,
  headDownloadRef,
  parsePrUrl,
  refsFromHeaderText,
  buildRefsFromRaw,
} from './prRefs';
import { archiveUrl } from './githubZip';
import { parsePatchHead, parseUnifiedDiff } from './prDiff';
import { diffTrees } from './diffTrees';
import { strToU8 } from 'fflate';
import type { FileTree } from './repoZip';

describe('prRefs.parsePrRefs', () => {
  it('reads base/head refs + head SHA from embedded PR data (same-repo)', () => {
    const html = `<script>{"baseRefName":"main","headRefName":"feature/x",
      "baseRefOid":"${'a'.repeat(40)}","headRefOid":"${'b'.repeat(40)}"}</script>`;
    const r = parsePrRefs(html, 'acme', 'web');
    expect(r).toMatchObject({
      baseOwner: 'acme', baseRepo: 'web', baseRef: 'main',
      headOwner: 'acme', headRepo: 'web', headRef: 'feature/x',
      headSha: 'b'.repeat(40),
    });
    expect(refsAreUsable(r)).toBe(true);
    expect(headDownloadRef(r)).toBe('b'.repeat(40)); // prefer immutable SHA
  });

  it('extracts refs from a NESTED embedded-JSON script (React PR page — deep monorepo case)', () => {
    // Mirrors GitHub's modern PR page: data buried deep under react-app.embeddedData.
    const payload = JSON.stringify({
      payload: { preloadedQueries: [{ result: { data: { repository: { pullRequest: {
        number: 1358,
        baseRefName: 'main',
        headRefName: 'response-apis-T2',
        headRefOid: 'a'.repeat(40),
        title: 'PUT /response/{disputeId}',
        headRepository: { name: 'monorepo', owner: { login: 'acme-engineering' } },
      } } } } }] },
    });
    const html = `<div>page</div><script type="application/json" data-target="react-app.embeddedData">${payload}</script>`;
    const r = parsePrRefs(html, 'acme-engineering', 'monorepo');
    expect(r.baseRef).toBe('main');
    expect(r.headRef).toBe('response-apis-T2');
    expect(r.headSha).toBe('a'.repeat(40));
    expect(r.headOwner).toBe('acme-engineering');
    expect(r.headRepo).toBe('monorepo');
    expect(r.title).toBe('PUT /response/{disputeId}');
    expect(refsAreUsable(r)).toBe(true);
  });

  it('detects a fork head repository', () => {
    const html = `{"baseRefName":"main","headRefName":"patch-1",
      "headRefOid":"${'c'.repeat(40)}",
      "headRepository":{"name":"web","owner":{"login":"contributor"}}}`;
    const r = parsePrRefs(html, 'acme', 'web');
    expect(r.headOwner).toBe('contributor');
    expect(r.headRepo).toBe('web');
  });

  it('falls back to main + same-repo when markup is missing', () => {
    const r = parsePrRefs('<html>nothing</html>', 'acme', 'web');
    expect(r.baseRef).toBe('main');
    expect(r.headOwner).toBe('acme');
    expect(refsAreUsable(r)).toBe(false); // no head ref/sha → not usable
  });

  it('scrapes the PR title from the visible heading', () => {
    const html = `{"baseRefName":"main","headRefName":"x","headRefOid":"${'a'.repeat(40)}"}
      <bdi class="js-issue-title markdown-title">feat: add caching layer</bdi>`;
    expect(parsePrRefs(html, 'acme', 'web').title).toBe('feat: add caching layer');
  });
});

describe('prRefs.refsFromHeaderText (robust DOM fallback)', () => {
  it('reads base/head from the stable PR header text (deep monorepo case)', () => {
    // The visible header: "…wants to merge 4 commits into main from response-apis-T2".
    const doc = new DOMParser().parseFromString(
      `<body><div>octodev wants to merge 4 commits into main from response-apis-T2 </div></body>`,
      'text/html',
    );
    expect(refsFromHeaderText(doc)).toEqual({ base: 'main', head: 'response-apis-T2' });
  });

  it('handles a fork head (owner:branch)', () => {
    const doc = new DOMParser().parseFromString(
      `<body>wants to merge 2 commits into develop from contributor:feature/x</body>`,
      'text/html',
    );
    expect(refsFromHeaderText(doc)).toEqual({ base: 'develop', head: 'contributor:feature/x' });
  });

  it('returns null when the header text is absent', () => {
    const doc = new DOMParser().parseFromString(`<body>nothing here</body>`, 'text/html');
    expect(refsFromHeaderText(doc)).toBeNull();
  });
});

describe('prRefs.buildRefsFromRaw (injected-reader result → PrRefs)', () => {
  it('builds same-repo refs from a header-text read', () => {
    const r = buildRefsFromRaw(
      { base: 'main', head: 'response-apis-T2', baseSha: null, headSha: null, headRepoName: null, headRepoOwner: null, title: 'feat: x' },
      'acme-engineering', 'monorepo',
    );
    expect(r).toMatchObject({
      baseOwner: 'acme-engineering', baseRepo: 'monorepo', baseRef: 'main',
      headOwner: 'acme-engineering', headRepo: 'monorepo', headRef: 'response-apis-T2', title: 'feat: x',
    });
    expect(refsAreUsable(r)).toBe(true);
  });

  it('prefers head sha + fork repo from the embedded-JSON read', () => {
    const r = buildRefsFromRaw(
      { base: 'develop', head: 'feature', baseSha: null, headSha: 'a'.repeat(40), headRepoName: 'web', headRepoOwner: 'contributor', title: null },
      'acme', 'web',
    );
    expect(r?.headOwner).toBe('contributor');
    expect(r?.headSha).toBe('a'.repeat(40));
    expect(headDownloadRef(r!)).toBe('a'.repeat(40));
  });

  it('returns null without a head', () => {
    expect(buildRefsFromRaw({ base: 'main', head: null, baseSha: null, headSha: null, headRepoName: null, headRepoOwner: null, title: null }, 'a', 'b')).toBeNull();
    expect(buildRefsFromRaw(null, 'a', 'b')).toBeNull();
  });
});

describe('prRefs.parsePrUrl', () => {
  it('extracts host/owner/repo/number from a PR URL (works on any PR, no comment)', () => {
    expect(parsePrUrl('https://github.com/acme/web/pull/123')).toEqual({
      owner: 'acme', repo: 'web', number: 123, host: 'github.com',
    });
    expect(parsePrUrl('https://github.com/a/b/pull/7/files?diff=split')).toEqual({
      owner: 'a', repo: 'b', number: 7, host: 'github.com',
    });
  });
  it('works on GitHub Enterprise hosts (github.<org>.<tld>)', () => {
    expect(parsePrUrl('https://github.intuit.com/acme/web/pull/42')).toEqual({
      owner: 'acme', repo: 'web', number: 42, host: 'github.intuit.com',
    });
    expect(parsePrUrl('https://github.my-enterprise.com/a/b/pull/1')).toEqual({
      owner: 'a', repo: 'b', number: 1, host: 'github.my-enterprise.com',
    });
  });
  it('returns null off a PR page or non-GitHub host', () => {
    expect(parsePrUrl('https://github.com/acme/web/issues/9')).toBeNull();
    expect(parsePrUrl('https://example.com')).toBeNull();
    expect(parsePrUrl('https://gitlab.com/a/b/pull/1')).toBeNull();
    expect(parsePrUrl('not a url')).toBeNull();
  });
});

describe('githubZip.archiveUrl', () => {
  it('uses the github.com archive endpoint (auth-redirects for private repos)', () => {
    // github.com/archive (not codeload) so the session cookie authenticates the
    // private repo, then 302→codeload with a signed token.
    expect(archiveUrl('a', 'b', 'feature/x')).toBe('https://github.com/a/b/archive/refs/heads/feature/x.zip');
    expect(archiveUrl('a', 'b', 'd'.repeat(40))).toBe(`https://github.com/a/b/archive/${'d'.repeat(40)}.zip`);
  });
  it('targets an enterprise host when given one', () => {
    expect(archiveUrl('a', 'b', 'feature/x', 'github.intuit.com')).toBe(
      'https://github.intuit.com/a/b/archive/refs/heads/feature/x.zip',
    );
  });
});

describe('prDiff — .patch head sha + .diff changed files (the robust path)', () => {
  it('parses the HEAD sha (last commit) + subject from a .patch', () => {
    const patch = [
      `From ${'a'.repeat(40)} Mon Sep 17 00:00:00 2001`,
      'Subject: [PATCH 1/2] first commit',
      '',
      `From ${'b'.repeat(40)} Mon Sep 17 00:00:00 2001`,
      'Subject: [PATCH 2/2] feat: response-service-acl T2',
      '',
    ].join('\n');
    const r = parsePatchHead(patch);
    expect(r.headSha).toBe('b'.repeat(40)); // LAST From = head
    expect(r.title).toBe('feat: response-service-acl T2');
  });

  it('parses changed files + numstat (A/M/D) from a unified .diff', () => {
    const diff = [
      'diff --git a/src/app.py b/src/app.py',
      'index 111..222 100644',
      '--- a/src/app.py',
      '+++ b/src/app.py',
      '@@ -1,2 +1,3 @@',
      ' ctx',
      '-old',
      '+new1',
      '+new2',
      'diff --git a/new.py b/new.py',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/new.py',
      '@@ -0,0 +1,1 @@',
      '+hello',
      'diff --git a/gone.py b/gone.py',
      'deleted file mode 100644',
      '--- a/gone.py',
      '+++ /dev/null',
      '@@ -1,1 +0,0 @@',
      '-bye',
    ].join('\n');
    const d = parseUnifiedDiff(diff);
    // changed-files = files present at HEAD (git --diff-filter=ACMRT). The
    // deleted file is EXCLUDED here (it can't be walked) but kept in diffStatus.
    expect(d.changedPaths.sort()).toEqual(['new.py', 'src/app.py']);
    expect(d.diffStats).toMatch(/^2\t1\tsrc\/app\.py$/m); // 2 adds, 1 del
    expect(d.diffStats).toMatch(/^1\t0\tnew\.py$/m);
    expect(d.diffStats).toMatch(/^0\t1\tgone\.py$/m); // delete kept in numstat (removed-card LOC)
    // diff-status carries the full git --name-status set, deletions included.
    expect(d.diffStatus.split('\n').sort()).toEqual(['A\tnew.py', 'D\tgone.py', 'M\tsrc/app.py']);
  });
});

describe('diffTrees', () => {
  const base: FileTree = new Map([
    ['keep.py', strToU8('x=1\n')],
    ['mod.py', strToU8('a\nb\nc\n')],
    ['gone.py', strToU8('bye\n')],
  ]);
  const head: FileTree = new Map([
    ['keep.py', strToU8('x=1\n')],
    ['mod.py', strToU8('a\nB\nc\nd\n')],
    ['new.py', strToU8('hi\nthere\n')],
  ]);

  it('classifies A/M/D and emits numstat, ignoring unchanged files', () => {
    const d = diffTrees(base, head);
    const byPath = Object.fromEntries(d.changed.map((c) => [c.path, c.status]));
    expect(byPath).toEqual({ 'mod.py': 'M', 'new.py': 'A', 'gone.py': 'D' });
    expect(d.changedPaths).not.toContain('keep.py'); // identical → not changed
    // numstat shape: adds<TAB>dels<TAB>path
    expect(d.diffStats).toMatch(/^\d+\t\d+\tgone\.py$/m);
    const added = d.changed.find((c) => c.path === 'new.py')!;
    expect(added.adds).toBe(2);
    expect(added.dels).toBe(0);
  });
});
