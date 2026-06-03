// Executable entry for the headless scanner: `npm run scan -- <pr-url> [--pretty] [-o out.json]`.
// All logic lives in (and is tested via) ./scan; this file is just the process shell.
import { main } from './scan';

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(`✗ ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  },
);
