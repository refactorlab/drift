# denoland/deno #25470 — fix(ext/node): support createConnection option in node:http.request()

**[View PR on GitHub](https://github.com/denoland/deno/pull/25470)**

| | |
|---|---|
| **Author** | @satyarohith |
| **Status** | ✅ merged |
| **Opened** | 2024-09-05 |
| **Repo** | curated review-culture seed |
| **Diff** | +465 / −597 across 21 files |
| **Engagement** | 31 conversation · 33 inline review comments |

## Top review comments (ranked by reactions)

### @bartlomieju — 9 reactions  
`👍 1 · 🎉 8`  ·  [link](https://github.com/denoland/deno/pull/25470#issuecomment-2520292171)

> I will review and merge it after 2.1.3 is released tonight so we have a few days to test it out on canary before putting it in a release build.

### @kt3k — 8 reactions  
`🎉 8`  ·  [link](https://github.com/denoland/deno/pull/25470#issuecomment-2488243258)

> This should be ready for review again now. PTAL @bartlomieju

### @bartlomieju — 3 reactions  
`👍 3`  ·  [link](https://github.com/denoland/deno/pull/25470#issuecomment-2543843680)

> It's not released yet. please run `deno upgrade canary` and let us know if it solved the problem for you.

### @cobbvanth — 2 reactions  
`👍 2`  ·  [link](https://github.com/denoland/deno/pull/25470#issuecomment-2440087851)

> Can we get this merged asap, it fixes vital issues with many libraries!

### @kt3k — 1 reactions  
`👍 1`  ·  [link](https://github.com/denoland/deno/pull/25470#issuecomment-2422432908)

> `node-gyp` internally uses `npm:make-fetch-happen` for making http request, and that package doesn't seem working with this branch. The below script works with Node and stable Deno, but doesn't with this branch:
> 
> ```js
> import fetch from "make-fetch-happen";
> const res = await fetch("http://example.com");
> console.log(res.status);
> ```

### @0xkalle — 1 reactions  
`🚀 1`  ·  [link](https://github.com/denoland/deno/pull/25470#issuecomment-2543866855)

> https://github.com/denoland/deno/issues/26735 fixed on canary.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
