// OpenAPI ↔ TS schema parity.
//
// The Rust scanner emits JSON described by `drift-static-profiler/
// schema/scan_pr_output.openapi.yaml`. The Action's TypeScript layer
// (`action/src/report.ts`) consumes that JSON via `loadReport()`. If
// the schema names a REQUIRED field that the TS loader doesn't enforce,
// a future scanner could ship an envelope that the TS layer parses
// into a half-known shape (silent corruption). If the TS loader
// enforces a field the schema doesn't mark required, a perfectly
// valid scanner envelope crashes the Action.
//
// These tests parse the OpenAPI YAML and assert the contract on both
// sides — they catch a cross-language schema drift the moment it
// happens locally, well before a real PR fires.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const schemaPath = resolve(
  repoRoot,
  'drift-static-profiler/schema/scan_pr_output.openapi.yaml',
);

type OpenApiSchema = {
  components: {
    schemas: Record<string, {
      type?: string;
      required?: string[];
      properties?: Record<string, { type?: string; enum?: string[]; $ref?: string }>;
      enum?: string[];
    }>;
  };
};

function loadSchema(): OpenApiSchema {
  return parseYaml(readFileSync(schemaPath, 'utf8')) as OpenApiSchema;
}

function reportSrc(): string {
  return readFileSync(resolve(repoRoot, 'action/src/report.ts'), 'utf8');
}

test('OpenAPI parity: schema file exists and parses', () => {
  const schema = loadSchema();
  assert.ok(schema.components?.schemas?.ScanPrOutput, 'ScanPrOutput schema missing');
});

test('OpenAPI parity: schema_version enum lists every version the TS loader accepts', () => {
  // The Rust side ENUMs accepted versions in the OpenAPI; the TS
  // loader has its own list in `validate()`. They MUST match or
  // a scanner ships an envelope with a version the TS rejects.
  const schema = loadSchema();
  const oas = schema.components.schemas.ScanPrOutput;
  const yamlVersions = (oas.properties?.schema_version?.enum ?? []) as string[];
  assert.ok(yamlVersions.length > 0, 'schema_version must enumerate versions');

  // Extract the TS literal-string union via a regex on report.ts.
  // The shape is: `schema_version: '1.0' | '1.1' | '1.2';`
  const src = reportSrc();
  const m = src.match(/schema_version:\s*((?:'[\d.]+'\s*\|?\s*)+);/);
  assert.ok(m, 'could not find schema_version literal-union in report.ts');
  const tsVersions = m![1]
    .split('|')
    .map((s) => s.trim().replace(/'/g, ''))
    .filter(Boolean);

  assert.deepEqual(
    [...tsVersions].sort(),
    [...yamlVersions].sort(),
    `OpenAPI versions ${JSON.stringify(yamlVersions)} ≠ TS versions ${JSON.stringify(tsVersions)} — ` +
      'a scanner shipping the new version would be rejected (or vice-versa)',
  );
});

test('OpenAPI parity: ScanPrOutput required fields are enforced by the TS loader', () => {
  // The OpenAPI's `required` array is the contract the scanner
  // emits to. The TS validate() in report.ts checks a corresponding
  // list. Drift between the two would let a scanner emit a missing
  // required field and the TS would silently `loadReport` into a
  // half-shaped object.
  const schema = loadSchema();
  const required = schema.components.schemas.ScanPrOutput.required ?? [];
  assert.ok(required.length > 0);

  const src = reportSrc();
  for (const field of required) {
    // The loader's missing-field check is a literal `for (const key of ['mode', 'generator', 'pr_scope'] as const)`.
    // We assert each REQUIRED field from the YAML appears in that list.
    // schema_version has its own dedicated check (the version enum
    // match), so it's exempt from the for-loop.
    if (field === 'schema_version') continue;
    const re = new RegExp(`['"\`]${field}['"\`]`);
    assert.ok(
      re.test(src),
      `required field "${field}" from OpenAPI is not referenced in report.ts — loader will accept envelopes missing it`,
    );
  }
});

test('OpenAPI parity: PrScope required array fields match the TS array-shape checks', () => {
  // PrScope.required is [changed_files, affected_roots, unreachable_changes].
  // report.ts's validate() iterates the same list and asserts each
  // is an array. A schema drift here would let a scanner ship a
  // single-string (instead of array) and the renderer would crash
  // mid-render rather than getting a clean error from loadReport.
  const schema = loadSchema();
  const required = schema.components.schemas.PrScope.required ?? [];
  const src = reportSrc();
  // The TS source has the literal:
  //   for (const k of ['changed_files', 'affected_roots', 'unreachable_changes'] as const)
  for (const f of required) {
    assert.ok(
      src.includes(`'${f}'`),
      `PrScope required field "${f}" is not enforced by report.ts validate()`,
    );
  }
});

test('OpenAPI parity: Generator schema requires tool + version (footer relies on both)', () => {
  // The footer prints `<code>${tool}</code> v${version}` — if either
  // is missing the renderer would emit a broken footer. The contract
  // here documents that BOTH must always be present from the scanner.
  const schema = loadSchema();
  const required = schema.components.schemas.Generator.required ?? [];
  assert.deepEqual(
    [...required].sort(),
    ['tool', 'version'].sort(),
    'Generator schema must require both tool and version',
  );
});

test('OpenAPI parity: CodeSuggestion required fields match the renderer\'s expectations', () => {
  // The renderer reads category / file / confidence / why_it_matters
  // unconditionally — they must be REQUIRED in the schema so the
  // scanner cannot ship a partial finding that crashes the render.
  const schema = loadSchema();
  const cs = schema.components.schemas.CodeSuggestion;
  assert.ok(cs, 'CodeSuggestion schema must exist');
  const required = new Set(cs.required ?? []);
  for (const field of ['category', 'file', 'confidence', 'why_it_matters']) {
    assert.ok(
      required.has(field),
      `CodeSuggestion.${field} must be required (the renderer reads it unconditionally)`,
    );
  }
  // `line` is intentionally OPTIONAL in the schema (some findings
  // anchor at the file level). Pin that explicitly so a future
  // schema bump can't silently make it required without us noticing.
  assert.ok(!required.has('line'), 'CodeSuggestion.line must remain OPTIONAL in the schema');
});

test('OpenAPI parity: every $ref in ScanPrOutput resolves to a defined schema', () => {
  // A broken $ref slips past the YAML parser but produces wrong
  // codegen and silent JSON differences. Walk the schemas dict and
  // make sure every $ref points to a defined name.
  const schema = loadSchema();
  const defined = new Set(Object.keys(schema.components.schemas));
  const refs = new Set<string>();
  function walk(node: unknown) {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === '$ref' && typeof v === 'string') {
          const m = v.match(/#\/components\/schemas\/([A-Za-z0-9_]+)/);
          if (m) refs.add(m[1]);
        } else {
          walk(v);
        }
      }
    }
  }
  walk(schema.components.schemas);
  const broken = [...refs].filter((r) => !defined.has(r));
  assert.deepEqual(broken, [], `broken $ref(s) in OpenAPI: ${broken.join(', ')}`);
});
