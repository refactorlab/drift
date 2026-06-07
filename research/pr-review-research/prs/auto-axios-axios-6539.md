# axios/axios #6539 — fix(sec): disregard protocol-relative URL to remediate SSRF

**[View PR on GitHub](https://github.com/axios/axios/pull/6539)**

| | |
|---|---|
| **Author** | @hainenber |
| **Status** | ✅ merged |
| **Opened** | 2024-08-12 |
| **Repo importance** | ★109,097 · 11,718 forks · score 160,966 |
| **Diff** | +49 / −4 across 3 files |
| **Engagement** | 25 conversation · 1 inline review comments |

## Top review comments (ranked by reactions)

### @bhaugeea — 66 reactions  
`👍 33 · ❤️ 33`  ·  [link](https://github.com/axios/axios/pull/6539#issuecomment-2284969035)

> > Komaan vriend, die gemeenskap wag
> 
> It's the middle of the night for the unpaid maintainer in South Africa.

### @pmconne — 49 reactions  
`👍 23 · ❤️ 17 · 😄 9`  ·  [link](https://github.com/axios/axios/pull/6539#issuecomment-2286104625)

> *psst...if you are not a maintainer, then your approval will not hasten the process. It may, however, annoy the maintainer with useless notifications. Just be patient.*

### @torokati44 — 47 reactions  
`👀 6 · 😄 36 · 👎 5`  ·  [link](https://github.com/axios/axios/pull/6539#issuecomment-2285599826)

> _There's a legend that if enough random passers-by approve a PR, it gets merged automatically by GH! 👀🙄_

### @hainenber — 40 reactions  
`❤️ 18 · 😄 22`  ·  [link](https://github.com/axios/axios/pull/6539#issuecomment-2286504453)

> Thanks @jasonsaayman for your admin work and @SilverSting for the initial analysis. None will come into fruition without you guys.
> 
> I'll readily help tackling the resulting complaints as I'm the one introducing the change. It's not exactly the resolution I perceive to be in the long run as well, with non-compliant Axios spec and my wish to keep browser behavior unchanged.
> 
> On an unrelated note, holy moly, this is probably my most-reviewed PR :D

### @torokati44 — 16 reactions  
`👍 1 · 😄 4 · 👎 11`  ·  [link](https://github.com/axios/axios/pull/6539#issuecomment-2286109013)

> _This is fake news!! More grey ticks is faster mergings!!!! 😆_ /s (sorry)

### @jasonsaayman — 13 reactions  
`👍 7 · ❤️ 1 · 👀 5`  ·  [link](https://github.com/axios/axios/pull/6539#issuecomment-2286492862)

> This fundamentally changes the way URIs are handled, and from a quick reading through the RFC, I see that this makes the Axios spec uncompliant.
> 
> I am pretty certain we will see some complaints about this change. However, this does solve the CVE for now, and I will work on a better solution as soon as I can.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
