# sherlock-project/sherlock #2610 — Add MuseScore site (clean version)

**[View PR on GitHub](https://github.com/sherlock-project/sherlock/pull/2610)**

| | |
|---|---|
| **Author** | @eslteacher902010 |
| **Status** | ✅ merged |
| **Opened** | 2025-10-05 |
| **Repo importance** | ★84,545 · 9,867 forks · score 129,009 |
| **Diff** | +9 / −0 across 1 files |
| **Engagement** | 15 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @eslteacher902010 — 1 reactions  
`🎉 1`  ·  [link](https://github.com/sherlock-project/sherlock/pull/2610#issuecomment-3371973981)

> Thanks @akh7177 and @ppfeister. I confirmed locally that MuseScore returns a 403 for HEAD requests but works correctly with GET. I added "request_method": "GET" under "errorType": "status_code" and verified the following:
> 
> arrangeme → Found (200)
> 
> thisuserdoesnotexist999 → Not Found (404)
> 
> This resolves the 403 issue on my end, though I haven’t seen other sites using a request_method field yet.

### @eslteacher902010 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/sherlock-project/sherlock/pull/2610#issuecomment-3372898501)

> Thanks! Just pushed the update with "request_method": "GET" for MuseScore.

### @akh7177 — 0 reactions  
`—`  ·  [link](https://github.com/sherlock-project/sherlock/pull/2610#issuecomment-3369116058)

> Hello @eslteacher902010 ,
> 
> When checked against the claimed username mentioned in the commit (https://musescore.com/musescore), I end up at 404 Page not found. Could you please check where the issue lies, the endpoint or the claimed username? It might also be a region related issue. Kindly have a look and lemme know!
> 
> (Thanks for cleaning up the PR)

### @eslteacher902010 — 0 reactions  
`—`  ·  [link](https://github.com/sherlock-project/sherlock/pull/2610#issuecomment-3369161051)

> @akh7177 Thanks! I switched the username to arrangeme, which resolves correctly in the browser. It seems MuseScore returns 403 for automated requests, so that might explain the difference.

### @akh7177 — 0 reactions  
`—`  ·  [link](https://github.com/sherlock-project/sherlock/pull/2610#issuecomment-3369164675)

> > @akh7177 Thanks! I switched the username to arrangeme, which resolves correctly in the browser. It seems MuseScore returns 403 for automated requests, so that might explain the difference.
> 
> Even https://musescore.com/user/arrangeme hits me with Page Not Found. Is it not the case for you?

### @eslteacher902010 — 0 reactions  
`—`  ·  [link](https://github.com/sherlock-project/sherlock/pull/2610#issuecomment-3369167191)

> You’re right — sorry about that! I shouldn’t have included /user/ in the path. I’ve updated it to https://musescore.com/{} since https://musescore.com/arrangeme resolves correctly now.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
