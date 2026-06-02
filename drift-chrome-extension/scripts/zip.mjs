// Package dist/ into a store-uploadable zip. Uses the system `zip`.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
if (!existsSync(dist)) {
  console.error('No dist/ — run `npm run build` first.');
  process.exit(1);
}
mkdirSync(resolve(root, 'release'), { recursive: true });
const out = resolve(root, 'release', 'drift-lens.zip');
// Start fresh: `zip -r` UPDATES an existing archive, so without this the
// hashed bundles from every prior build pile up (stale dead code shipped to
// the store). Remove it first so the zip mirrors dist/ exactly.
rmSync(out, { force: true });
// Exclude macOS junk so it never lands in the uploaded package.
execFileSync('zip', ['-r', '-X', out, '.', '-x', '.DS_Store', '-x', '*/.DS_Store'], {
  cwd: dist,
  stdio: 'inherit',
});
console.log(`\n→ ${out}`);
