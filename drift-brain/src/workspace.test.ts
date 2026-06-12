import { describe, it, expect } from "bun:test";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { sanitizeKey, safeJoin, renderFileDiff, renderIndex, writeWorkspace, type WsFile } from "./workspace";

describe("sanitizeKey", () => {
  it("turns a PR key into a safe dir name", () => {
    expect(sanitizeKey("acme/webapp#142")).toBe("acme-webapp-142");
  });
  it("never yields an empty name", () => {
    expect(sanitizeKey("///")).toBe("pr");
  });
});

describe("safeJoin", () => {
  const base = "/tmp/ws";
  it("resolves a normal relative path inside base", () => {
    expect(safeJoin(base, "src/app.ts.diff")).toBe("/tmp/ws/src/app.ts.diff");
  });
  it("strips a leading slash instead of escaping to the fs root", () => {
    expect(safeJoin(base, "/etc/passwd")).toBe("/tmp/ws/etc/passwd");
  });
  it("rejects traversal that escapes base", () => {
    expect(safeJoin(base, "../../etc/passwd")).toBeNull();
    expect(safeJoin(base, "a/../../b")).toBeNull();
  });
});

describe("renderFileDiff", () => {
  it("renders header + signed hunk lines", () => {
    const f: WsFile = {
      path: "src/billing.ts",
      status: "M",
      additions: 1,
      deletions: 1,
      hunks: [
        {
          header: "@@ -1,2 +1,2 @@",
          lines: [
            { type: "del", text: "retry(1);" },
            { type: "add", text: "retry(3);" },
            { type: "context", text: "return ok;" },
          ],
        },
      ],
    };
    const out = renderFileDiff(f);
    expect(out).toContain("# src/billing.ts");
    expect(out).toContain("@@ -1,2 +1,2 @@");
    expect(out).toContain("-retry(1);");
    expect(out).toContain("+retry(3);");
    expect(out).toContain(" return ok;");
  });
});

describe("renderIndex", () => {
  it("lists every file with its .diff path", () => {
    const out = renderIndex([{ path: "a.ts", additions: 2, deletions: 0 }]);
    expect(out).toContain("a.ts.diff (M, +2 -0)");
  });
});

describe("writeWorkspace", () => {
  it("writes one .diff per file + INDEX.md and rejects traversal paths", async () => {
    const files: WsFile[] = [
      { path: "src/app.ts", additions: 1, hunks: [{ header: "@@ a @@", lines: [{ type: "add", text: "x" }] }] },
      { path: "../escape.ts", additions: 1, hunks: [] }, // must be skipped by safeJoin
    ];
    const res = await writeWorkspace("brain-unit-test#1", files);
    try {
      expect(res.written).toBe(1);
      expect(res.skipped).toEqual(["../escape.ts"]);
      expect(await readFile(path.join(res.dir, "src/app.ts.diff"), "utf8")).toContain("+x");
      expect(await readFile(path.join(res.dir, "INDEX.md"), "utf8")).toContain("src/app.ts.diff");
    } finally {
      await rm(res.dir, { recursive: true, force: true });
    }
  });
});
