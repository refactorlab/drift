# vercel/next.js #79787 — [dynamicIO] Document client component remediations for sync IO

**[View PR on GitHub](https://github.com/vercel/next.js/pull/79787)**

| | |
|---|---|
| **Author** | @gnoff |
| **Status** | ✅ merged |
| **Opened** | 2025-05-28 |
| **Repo importance** | ★139,820 · 31,201 forks · score 269,622 |
| **Diff** | +601 / −45 across 8 files |
| **Engagement** | 21 conversation · 52 inline review comments |

## Top review comments (ranked by reactions)

### @ijjk — 0 reactions  
`—`  ·  [link](https://github.com/vercel/next.js/pull/79787#issuecomment-2916734723)

> # Stats from current PR
> 
> <details open>
> <summary><strong>Default Build</strong> (Increase detected ⚠️)</summary>
> 
> <br/>
> 
> <details>
> <summary><strong>General</strong> Overall increase ⚠️</summary>
> 
> |  | vercel/next.js canary  | gnoff/next.js document-client-sync-io | Change |
> | - | - | - | - |
> | buildDuration | 30.5s | 29s | N/A |
> | buildDurationCached | 27.5s | 20.9s | N/A |
> | nodeModulesSize | 429 MB | 429 MB | ⚠️ +10 kB |
> | nextStartRea..uration (ms) | 632ms | 742ms | ⚠️ +110ms |
> 
> </details>
> 
> <details>
> <summary><strong>Client Bundles (main, webpack)</strong> Overall increase ⚠️</summary>
> 
> |  | vercel/next.js canary  | gnoff/next.js document-client-sync-io | Change |
> | - | - | - | - |
> | 194b18f3-HASH.js gzip | 53.8 kB | 53.8 kB | N/A |
> | 2192.HASH.js gzip | 169 B | 169 B | ✓ |
> | 4719-HASH.js gzip | 5.47 kB | 5.44 kB | N/A |
> | 6236-HASH.js gzip | 44.4 kB | 44.9 kB | ⚠️ +455 B |
> | framework-HASH.js gzip | 57.4 kB | 57.4 kB | ✓ |
> | main-app-HASH.js gzip | 251 B | 256 B | N/A |
> | main-HASH.js gzip | 33.5 kB | 33.5 kB | N/A |
> | webpack-HASH.js gzip | 1.71 kB | 1.71 kB | N/A |
> | Overall change | 102 kB | 103 kB | ⚠️ +455 B |
> 
> </details>
> 
> <details>
> <summary><strong>Legacy Client Bundles (polyfills)</strong></summary>
> 
> |  | vercel/next.js canary  | gnoff/next.js document-client-sync-io | Change |
> | - | - | - | - |
> | polyfills-HASH.js gzip | 39.4 kB | 39.4 kB | ✓ |
> | Overall change | 39.4 kB | 39.4 kB | ✓ |
> 
> </details>
> 
> <details>
> <summary><strong>Client Pages</strong></summary>
> 
> |  | vercel/next.js canary  | gnoff/next.js document-client-sync-io | Change |
> | - | - | - | - |
> | _app-H … *[truncated]*

### @ijjk — 0 reactions  
`—`  ·  [link](https://github.com/vercel/next.js/pull/79787#issuecomment-2916754994)

> ## Tests Passed
> 
> <!-- ## Failing test suites -- >

### @unstubbable — 0 reactions  
`—`  ·  [link](https://github.com/vercel/next.js/pull/79787#issuecomment-2921962959)

> Wow, what a mess. Sorry, Josh! I was under the impression that Devin can add inline code suggestions. :(


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
