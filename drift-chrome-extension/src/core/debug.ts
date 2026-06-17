// Dev-only debug logging.
//
// Gated on Vite's `import.meta.env.DEV`:
//   • `make extension-dev` (→ `vite` dev server) → DEV === true  → logs ON.
//   • `make build` / `prod` / `zip` (→ `vite build`, PROD)        → DEV === false →
//     every `if (DEV)` branch is DEAD-CODE-ELIMINATED, so production ships with
//     ZERO logging and zero string overhead.
//
// Works in the page AND in Vite-bundled module workers (brain / asr / tts), where
// console output appears under that worker's context in DevTools. The raw
// public/voice-worklet.js is NOT bundled (no import.meta), so it takes an explicit
// debug flag via processorOptions instead — see audioCapture.ts.

const DEV: boolean = (() => {
  try {
    // Use the LITERAL `import.meta.env.DEV` so Vite statically replaces it
    // (true under `vite` dev, false under `vite build`) and the minifier can
    // dead-code-eliminate the logger body in production. The try/catch guards
    // non-Vite contexts (a bare node import of a pure module) where it'd throw.
    return !!import.meta.env.DEV;
  } catch {
    return false;
  }
})();

/** True only under `make extension-dev`. Use to guard ad-hoc dev-only work. */
export const DEBUG = DEV;

type Args = unknown[];

/** A scoped logger. CALLABLE — `log('x')` is shorthand for `log.log('x')`. */
export interface Logger {
  (...a: Args): void;
  log: (...a: Args) => void;
  warn: (...a: Args) => void;
  error: (...a: Args) => void;
  /** Start a timer; the returned fn logs `<label> ✓ <ms>ms` when called. */
  time: (label: string) => () => void;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : 0);

/** A scoped logger, e.g. `const log = logger('agent')`. No-ops in production. */
export function logger(scope: string): Logger {
  if (!DEV) {
    const noop = (() => {}) as Logger;
    noop.log = () => {};
    noop.warn = () => {};
    noop.error = () => {};
    noop.time = () => () => {};
    return noop;
  }
  const tag = `%c[drift:${scope}]`;
  const css = 'color:#e08600;font-weight:600';
  const base = ((...a: Args) => console.log(tag, css, ...a)) as Logger;
  base.log = (...a) => console.log(tag, css, ...a);
  base.warn = (...a) => console.warn(`[drift:${scope}]`, ...a);
  base.error = (...a) => console.error(`[drift:${scope}]`, ...a);
  base.time = (label) => {
    const t0 = now();
    return () => console.log(tag, css, `${label} ✓ ${Math.round(now() - t0)}ms`);
  };
  return base;
}
