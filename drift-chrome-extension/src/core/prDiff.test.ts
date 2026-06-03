// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseUnifiedDiff, parsePatchHead, fetchPrHead, fetchPrChangedFiles } from './prDiff';

// A unified diff exercising every status the scanner cares about: a plain
// modify, an add (`new file mode`), a delete (`deleted file mode`), and a
// rename WITH GitHub-style rename headers (`similarity index` / `rename
// from`/`to`). Reconstructing `--diff-status` from these headers — git-free,
// straight from the .diff text — is the whole point.
const DIFF = `diff --git a/src/app.py b/src/app.py
index 1111111..2222222 100644
--- a/src/app.py
+++ b/src/app.py
@@ -1,2 +1,3 @@
 def f():
-    return 1
+    return 2
+    # extra
diff --git a/src/new.py b/src/new.py
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/new.py
@@ -0,0 +1,2 @@
+def g():
+    pass
diff --git a/src/gone.py b/src/gone.py
deleted file mode 100644
index 4444444..0000000
--- a/src/gone.py
+++ /dev/null
@@ -1,2 +0,0 @@
-def old():
-    pass
diff --git a/old/name.py b/pkg/name.py
similarity index 95%
rename from old/name.py
rename to pkg/name.py
index 5555555..6666666 100644
--- a/old/name.py
+++ b/pkg/name.py
@@ -1 +1 @@
-x = 1
+x = 2
`;

describe('parseUnifiedDiff — git-free changed-files / numstat / diff-status', () => {
  const r = parseUnifiedDiff(DIFF);

  it('changed-files contains HEAD paths and EXCLUDES deletes (--diff-filter=ACMRT)', () => {
    expect(r.changedPaths).toContain('src/app.py'); // modified
    expect(r.changedPaths).toContain('src/new.py'); // added
    expect(r.changedPaths).toContain('pkg/name.py'); // rename → NEW path
    expect(r.changedPaths).not.toContain('src/gone.py'); // deleted → excluded
    expect(r.changedPaths).not.toContain('old/name.py'); // rename → OLD path excluded
  });

  it('numstat counts +/- lines and keeps the deleted file (for removed-card LOC)', () => {
    const lines = r.diffStats.split('\n');
    expect(lines).toContain('2\t1\tsrc/app.py');
    expect(lines).toContain('2\t0\tsrc/new.py');
    expect(lines).toContain('0\t2\tsrc/gone.py');
    expect(lines).toContain('1\t1\tpkg/name.py');
  });

  it('diff-status matches `git diff --name-status` shape (incl. D, R<sim> old→new)', () => {
    const lines = r.diffStatus.split('\n');
    expect(lines).toContain('M\tsrc/app.py');
    expect(lines).toContain('A\tsrc/new.py');
    expect(lines).toContain('D\tsrc/gone.py'); // deletes ARE in diff-status
    expect(lines).toContain('R95\told/name.py\tpkg/name.py');
  });

  it('exposes structured entries for the Changed-files UI (status + LOC + rename old→new)', () => {
    const byPath = Object.fromEntries(r.entries.map((e) => [e.path, e]));
    expect(byPath['src/app.py']).toMatchObject({ code: 'M', additions: 2, deletions: 1 });
    expect(byPath['src/new.py']).toMatchObject({ code: 'A', additions: 2, deletions: 0 });
    expect(byPath['src/gone.py']).toMatchObject({ code: 'D', deletions: 2 });
    expect(byPath['pkg/name.py']).toMatchObject({ code: 'R', oldPath: 'old/name.py' });
  });

  it('a rename with NO GitHub rename headers degrades to delete+add (no -M)', () => {
    // GitHub's raw .diff usually omits -M, so a move arrives as two blocks.
    const noM = `diff --git a/a.py b/a.py
deleted file mode 100644
index 1..0
--- a/a.py
+++ /dev/null
@@ -1 +0,0 @@
-x = 1
diff --git a/b.py b/b.py
new file mode 100644
index 0..1
--- /dev/null
+++ b/b.py
@@ -0,0 +1 @@
+x = 1
`;
    const out = parseUnifiedDiff(noM);
    expect(out.diffStatus.split('\n').sort()).toEqual(['A\tb.py', 'D\ta.py']);
    expect(out.changedPaths).toEqual(['b.py']); // delete excluded, add kept
  });
});

// GitHub returns HTTP 200 + an HTML page (redirecting `/pull/N` → `/issues/N`)
// when N is an issue, not a PR. Without a guard the parsers silently yield an
// empty set and the scan runs on nothing — found probing real PR numbers.
describe('issue-redirect / HTML responses are rejected (not silently empty)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const htmlResponse = () =>
    new Response('<!DOCTYPE html><html>…</html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });

  it('fetchPrChangedFiles throws when redirected to an issue page', async () => {
    const res = htmlResponse();
    Object.defineProperty(res, 'url', { value: 'https://github.com/o/r/issues/42' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));
    await expect(fetchPrChangedFiles('o', 'r', 42)).rejects.toThrow(/is an issue, not a pull request/);
  });

  it('fetchPrHead throws on an HTML (non-diff) body even without an issue URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(htmlResponse()));
    await expect(fetchPrHead('o', 'r', 7)).rejects.toThrow(/HTML page, not a diff/);
  });
});

describe('parsePatchHead', () => {
  it('takes the LAST `From <sha>` as the head commit and uses its subject', () => {
    const patch = `From 1111111111111111111111111111111111111111 Mon Sep 17 00:00:00 2001
Subject: [PATCH 1/2] first

From 2222222222222222222222222222222222222222 Mon Sep 17 00:00:00 2001
Subject: [PATCH 2/2] second and final

`;
    const head = parsePatchHead(patch);
    expect(head.headSha).toBe('2222222222222222222222222222222222222222');
    expect(head.title).toBe('second and final');
  });
});
