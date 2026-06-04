// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseUnifiedDiff,
  parsePatchHead,
  parsePatchCommits,
  fetchPrHead,
  fetchPrChangedFiles,
  fetchPrBody,
} from './prDiff';

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

  it('collects the literal +/- hunks per file (fileDiffs)', () => {
    const byPath = Object.fromEntries(r.fileDiffs.map((f) => [f.path, f]));
    const app = byPath['src/app.py'];
    expect(app.status).toBe('M');
    const adds = app.hunks.flatMap((h) => h.lines.filter((l) => l.type === 'add').map((l) => l.text));
    const dels = app.hunks.flatMap((h) => h.lines.filter((l) => l.type === 'del').map((l) => l.text));
    expect(adds).toEqual(['    return 2', '    # extra']);
    expect(dels).toEqual(['    return 1']);
    // context line carried for surrounding code
    expect(app.hunks[0].lines.some((l) => l.type === 'context' && l.text === 'def f():')).toBe(true);
    // hunk header preserved
    expect(app.hunks[0].header).toMatch(/^@@ /);
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

describe('parseUnifiedDiff — hunk collection edge cases', () => {
  it('does not mistake an added line whose content starts with `++` for a `+++` header', () => {
    const diff = `diff --git a/x.c b/x.c
index 1..2 100644
--- a/x.c
+++ b/x.c
@@ -1 +1,2 @@
 int x;
+++count;
`;
    const f = parseUnifiedDiff(diff).fileDiffs[0];
    expect(f.additions).toBe(1);
    const adds = f.hunks.flatMap((h) => h.lines.filter((l) => l.type === 'add').map((l) => l.text));
    expect(adds).toEqual(['++count;']);
  });

  it('caps stored hunk lines by the per-file budget but keeps +/- counts EXACT', () => {
    const body = Array.from({ length: 1600 }, (_, i) => `+line ${i}`).join('\n');
    const diff = `diff --git a/big.txt b/big.txt
new file mode 100644
--- /dev/null
+++ b/big.txt
@@ -0,0 +1,1600 @@
${body}
`;
    const r = parseUnifiedDiff(diff);
    const f = r.fileDiffs[0];
    expect(f.additions).toBe(1600); // count stays exact …
    const stored = f.hunks.flatMap((h) => h.lines).length;
    expect(stored).toBeLessThanOrEqual(1500); // … storage capped (per-file budget)
    expect(f.truncated).toBe(true);
    expect(r.diffTruncated).toBe(true);
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
    expect(head.commits).toEqual(['first', 'second and final']);
  });
});

// The .patch carries every commit (subject + body + the `---` diff separator) —
// the same data the action feeds via `git log --format=%B%x00`.
describe('parsePatchCommits', () => {
  it('extracts subject + body per commit, strips the [PATCH] prefix, stops at ---', () => {
    const patch = `From aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa Mon Sep 17 00:00:00 2001
From: Dev <dev@example.com>
Date: Mon, 1 Jan 2024 00:00:00 +0000
Subject: [PATCH 1/2] feat: add enrichment loop

Wires the order-enrichment pass into the handler.
Closes #42.
---
 src/app.py | 5 +++++
 1 file changed, 5 insertions(+)

diff --git a/src/app.py b/src/app.py
index 1..2 100644
--- a/src/app.py
+++ b/src/app.py
@@ -1 +1,2 @@
+loop
From bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb Mon Sep 17 00:00:00 2001
Subject: [PATCH 2/2] fix: handle empty rows

---
 src/app.py | 1 +
`;
    const commits = parsePatchCommits(patch);
    expect(commits).toHaveLength(2);
    expect(commits[0]).toBe(
      'feat: add enrichment loop\n\nWires the order-enrichment pass into the handler.\nCloses #42.',
    );
    expect(commits[1]).toBe('fix: handle empty rows');
    // body never bleeds in the diff
    expect(commits[0]).not.toContain('diff --git');
  });

  it('returns [] when there are no commits', () => {
    expect(parsePatchCommits('not a patch')).toEqual([]);
  });
});

describe('fetchPrBody — best-effort PR description', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the trimmed body from the REST API', async () => {
    const res = { ok: true, json: async () => ({ body: '  Fixes a bug.\n' }) };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));
    expect(await fetchPrBody('o', 'r', 7)).toBe('Fixes a bug.');
  });

  it('fail-softs to undefined on a non-OK response (e.g. private repo 404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    expect(await fetchPrBody('o', 'r', 7)).toBeUndefined();
  });

  it('fail-softs to undefined when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await fetchPrBody('o', 'r', 7)).toBeUndefined();
  });

  it('returns undefined for an empty body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ body: '' }) }));
    expect(await fetchPrBody('o', 'r', 7)).toBeUndefined();
  });
});
