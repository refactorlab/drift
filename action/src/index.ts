import { main } from './main.ts';
import { setFailed } from './core.ts';

main().catch((err) => {
  setFailed(err instanceof Error ? err.message : String(err));
});
