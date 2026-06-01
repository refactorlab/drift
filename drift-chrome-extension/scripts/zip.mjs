// Package dist/ into a store-uploadable zip. Uses the system `zip`.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
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
execFileSync('zip', ['-r', '-X', out, '.'], { cwd: dist, stdio: 'inherit' });
console.log(`\n→ ${out}`);
