// Schema-version coverage for loadReport. Drift's TS layer claims to
// understand schema_version values 1.0, 1.1, 1.2 (per validate() in
// report.ts). When the scanner advances the schema we need each
// supported version to keep parsing cleanly, AND older/newer values
// to be rejected with a NAMED reason rather than silently parsed into
// a partial / wrong-shape object.
//
// The existing e2e test already covers schema_version=99 rejection;
// this file pins the POSITIVE path for every advertised version + a
// representative v0.x rejection.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadReport } from '../report.ts';

function withReport(json: unknown, fn: (path: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'drift-schema-'));
  try {
    const path = join(root, 'r.json');
    writeFileSync(path, JSON.stringify(json));
    fn(path);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const VERSIONS = ['1.0', '1.1', '1.2'] as const;

for (const v of VERSIONS) {
  test(`schema_version="${v}": loadReport accepts a minimal valid report`, () => {
    withReport(
      {
        schema_version: v,
        mode: 'static',
        generator: { tool: 'drift-static-profiler', version: '0.6.0' },
        pr_scope: { changed_files: ['a.ts'], affected_roots: [], unreachable_changes: [] },
      },
      (path) => {
        const r = loadReport(path);
        assert.equal(r.schema_version, v);
        assert.equal(r.mode, 'static');
        assert.deepEqual(r.pr_scope.changed_files, ['a.ts']);
      },
    );
  });
}

test('schema_version="0.9": loadReport rejects with a named reason', () => {
  withReport(
    {
      schema_version: '0.9',
      mode: 'static',
      generator: { tool: 't', version: '1' },
      pr_scope: { changed_files: [], affected_roots: [], unreachable_changes: [] },
    },
    (path) => {
      assert.throws(
        () => loadReport(path),
        /Unsupported schema_version.*0\.9/,
        'a pre-1.0 schema must be rejected with the offending version named in the message',
      );
    },
  );
});

test('schema_version="2.0": loadReport rejects with a named reason (forward-incompatible)', () => {
  // The scanner could ship a 2.x in the future before the TS side is
  // updated. We MUST fail loudly so the user knows to bump the
  // Action, not silently parse a half-known shape.
  withReport(
    {
      schema_version: '2.0',
      mode: 'static',
      generator: { tool: 't', version: '1' },
      pr_scope: { changed_files: [], affected_roots: [], unreachable_changes: [] },
    },
    (path) => {
      assert.throws(
        () => loadReport(path),
        /Unsupported schema_version.*2\.0/,
        'a future schema must be rejected, not silently parsed',
      );
    },
  );
});

test('schema_version=number (not string): rejected — TS schema type is the literal string', () => {
  withReport(
    {
      schema_version: 1, // wrong type
      mode: 'static',
      generator: { tool: 't', version: '1' },
      pr_scope: { changed_files: [], affected_roots: [], unreachable_changes: [] },
    },
    (path) => {
      assert.throws(() => loadReport(path), /Unsupported schema_version/);
    },
  );
});

test('schema_version missing: rejected as Unsupported (not parsed as 1.x by default)', () => {
  withReport(
    {
      // No schema_version
      mode: 'static',
      generator: { tool: 't', version: '1' },
      pr_scope: { changed_files: [], affected_roots: [], unreachable_changes: [] },
    },
    (path) => {
      assert.throws(() => loadReport(path), /Unsupported schema_version/);
    },
  );
});

test('every supported schema version preserves the pr_review block when present', () => {
  // Just because the version line passes doesn't mean the structured
  // body survives — the loader's JSON.parse is the same shape across
  // versions, but assert it positively for every supported version
  // so a future incompatible field gets caught here.
  for (const v of VERSIONS) {
    withReport(
      {
        schema_version: v,
        mode: 'static',
        generator: { tool: 't', version: '1' },
        pr_scope: {
          changed_files: ['a.ts'],
          affected_roots: ['main'],
          unreachable_changes: [],
        },
        pr_review: {
          code_suggestions: [
            {
              category: 'A',
              file: 'a.ts',
              line: 5,
              confidence: 0.9,
              why_it_matters: 'multi-version probe — message ≥10 chars',
              references: [{ url: 'https://example.com/x' }],
            },
          ],
        },
      },
      (path) => {
        const r = loadReport(path);
        assert.equal(
          r.pr_review?.code_suggestions?.length,
          1,
          `pr_review survived round-trip for schema ${v}`,
        );
      },
    );
  }
});

test('required pr_scope subfields enforced regardless of version', () => {
  // pr_scope is the factual block; the loader enforces three array
  // fields. This is the load-bearing invariant the downstream code
  // relies on — drop ANY of them and the deterministic review
  // crashes mid-render.
  for (const missingKey of ['changed_files', 'affected_roots', 'unreachable_changes'] as const) {
    withReport(
      {
        schema_version: '1.2',
        mode: 'static',
        generator: { tool: 't', version: '1' },
        pr_scope: {
          changed_files: [],
          affected_roots: [],
          unreachable_changes: [],
          [missingKey]: undefined, // force the loader's must-be-array branch
        },
      },
      (path) => {
        assert.throws(
          () => loadReport(path),
          new RegExp(`pr_scope\\.${missingKey} must be an array`),
        );
      },
    );
  }
});
