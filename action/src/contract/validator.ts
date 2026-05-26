// Test-time validators backed by the scanner's OpenAPI 3.1 schemas.
//
// The Rust crate has its own conformance tests
// (drift-static-profiler/tests/pr_scope_schema.rs T1-T5). These TS
// validators mirror that — same YAML files, same `components.schemas.X`
// resolution trick, just on the JS side using ajv.
//
// IMPORTANT: this file is for *tests* only. It reads files from
// ../drift-static-profiler/schema/ relative to the action package, so
// it works in this monorepo. When we split the action to its own repo
// the schemas should be vendored.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// `import.meta.dirname` works under node --test --experimental-strip-types.
const here = dirname(fileURLToPath(import.meta.url));

const SCHEMA_DIR = join(here, '../../../drift-static-profiler/schema');

export type SchemaName = 'ScanPrInput' | 'ScanPrOutput';

export type Validator = (instance: unknown) => { ok: true } | { ok: false; errors: string[] };

/**
 * Load an OpenAPI doc and return an ajv validator targeting
 * `components.schemas.<name>`. Intra-doc `$ref`s like
 * `#/components/schemas/ChangedFile` resolve relative to the doc root.
 */
export function loadValidator(file: string, name: SchemaName): Validator {
  const raw = readFileSync(join(SCHEMA_DIR, file), 'utf8');
  const doc = parseYaml(raw) as Record<string, unknown>;

  // Wrap the doc with a top-level `$ref` pointing at the schema we care
  // about. ajv treats `$ref` at the top level as the entry-point
  // schema; all internal `$ref`s resolve within the same document.
  const wrapped = {
    ...doc,
    $ref: `#/components/schemas/${name}`,
  };

  const ajv = new Ajv2020.default({
    allErrors: true,
    strict: false,        // OpenAPI uses some non-JSON-Schema metadata keywords (e.g. `xml`, `discriminator`)
    validateFormats: true,
  });
  // `addFormats` ships ESM/CJS wrappers; the runtime-cast keeps both happy.
  (addFormats as unknown as (a: unknown) => void)(ajv);

  const validate = ajv.compile(wrapped);

  return (instance: unknown) => {
    const ok = validate(instance);
    if (ok) return { ok: true };
    const errors = (validate.errors ?? []).map(
      (e) => `${e.instancePath || '<root>'} ${e.message ?? ''} (keyword=${e.keyword})`,
    );
    return { ok: false, errors };
  };
}

/** Convenience constructors. */
export const inputValidator = (): Validator =>
  loadValidator('scan_pr_input.openapi.yaml', 'ScanPrInput');
export const outputValidator = (): Validator =>
  loadValidator('scan_pr_output.openapi.yaml', 'ScanPrOutput');
