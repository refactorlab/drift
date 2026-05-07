// Vercel Function entry point. Bun runtime is selected via `bunVersion` in
// vercel.json. Per Bun's Vercel guide, Bun.serve is unsupported here — the
// function runtime invokes our exported fetch handler directly.
import app from '../src/app.ts';

export default app;
