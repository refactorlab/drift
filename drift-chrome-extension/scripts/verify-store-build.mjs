// Store-build compliance gate. Asserts the PACKAGED tree (dist/) — the bytes we
// upload to the Chrome Web Store — contains NO remote-scanner-download code.
//
// Why: MV3 review rejects extensions that fetch + instantiate remotely-hosted
// WebAssembly (the transformers.js rejection pattern). The remote-download
// capability lives ONLY in src/core/scannerDownload.ts and is referenced behind
// the static `__DRIFT_STORE_BUILD__` flag, so a store build (DRIFT_STORE_BUILD=1)
// should dead-code-eliminate it entirely. This script PROVES that happened —
// it's the backstop against a refactor accidentally re-linking it.
//
// Run by `npm run zip` (store profile) and CI. Scans only text bundles (.js/
// .html/.css) — the 22 MB wasm is skipped (binary noise). Pure Node, no deps.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, process.argv[2] ?? 'dist');

// Sentinels that must NOT appear in a store bundle. REMOTE_SCANNER_TAG is the
// authoritative marker (it exists only inside scannerDownload.ts, referenced in
// a thrown message so minification keeps it). The release URL fragment is a
// secondary signal.
const FORBIDDEN = [
  { needle: '__DRIFT_REMOTE_SCANNER_CAPABILITY__', what: 'scannerDownload.ts remote-download module' },
  { needle: 'releases/latest/download', what: 'SCANNER_RELEASE_BASE release URL' },
];

const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.json']);

function walk(d) {
  const out = [];
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (TEXT_EXT.has(extname(name))) out.push(p);
  }
  return out;
}

console.log(`🔒 verifying STORE build is free of remote-scanner code in ${dir}`);
if (!existsSync(dir)) {
  console.error(`::error::package dir not found: ${dir} — run a store build first (DRIFT_STORE_BUILD=1 npm run build).`);
  process.exit(1);
}

const hits = [];
for (const file of walk(dir)) {
  const text = readFileSync(file, 'utf8');
  for (const { needle, what } of FORBIDDEN) {
    if (text.includes(needle)) {
      hits.push(`${file.slice(dir.length + 1)} contains "${needle}" (${what})`);
    }
  }
}

if (hits.length) {
  for (const h of hits) console.log(`::error::${h}`);
  console.error(
    `\n✗ store-build verification FAILED: the remote-download path leaked into the package.\n` +
      `  The store build must DCE it — check that references go through __DRIFT_STORE_BUILD__\n` +
      `  and that the build set DRIFT_STORE_BUILD=1.`,
  );
  process.exit(1);
}
console.log(`  ✓ no remote-scanner-download code in the store bundle`);
console.log(`\n✓ store build is MV3-clean — no remotely-hosted WASM path shipped.`);
