// Local Bun launcher. Vercel uses `api/index.ts` instead.
import app from './app.ts';

const port = Number(process.env.PORT ?? 8000);
console.log(`▲ Drift on http://localhost:${port}  (docs: /docs)`);

export default {
  port,
  fetch: app.fetch,
};
