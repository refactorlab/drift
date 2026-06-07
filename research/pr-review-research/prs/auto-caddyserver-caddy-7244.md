# caddyserver/caddy #7244 — logging: Switch from `lumberjack` to `timberjack`, add time-rolling options

**[View PR on GitHub](https://github.com/caddyserver/caddy/pull/7244)**

| | |
|---|---|
| **Author** | @aeris |
| **Status** | ✅ merged |
| **Opened** | 2025-09-06 |
| **Repo importance** | ★73,173 · 4,761 forks · score 97,210 |
| **Diff** | +130 / −53 across 3 files |
| **Engagement** | 21 conversation · 12 inline review comments |

## Top review comments (ranked by reactions)

### @francislavoie — 2 reactions  
`👍 2`  ·  [link](https://github.com/caddyserver/caddy/pull/7244#issuecomment-3310780325)

> Thanks!
> 
> FYI timberjack had a new release just now to add support for zstd compression (we should expose that option too) & adding a reason to manual rotation (so we could add support for rotating the files on config reload).
> 
> Another requested nice-to-have, we could also add support for opt-in reopening of the log file on config reload, useful for when users use their own external log rolling instead of what we provide them, we should reopen the log file so it correctly points to the new file instead of the moved file.

### @francislavoie — 2 reactions  
`👍 2`  ·  [link](https://github.com/caddyserver/caddy/pull/7244#issuecomment-3435909059)

> @DeRuina Matt is saying, if you'd like to go look through open Caddy issues for something that looks interesting for you to help with, that would be a good way to start if you'd like to help out with something 😅

### @aeris — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/caddyserver/caddy/pull/7244#issuecomment-3307921105)

> 👍 I try to fix docs & cie this week-end !

### @aeris — 1 reactions  
`👍 1`  ·  [link](https://github.com/caddyserver/caddy/pull/7244#issuecomment-3367059417)

> I can try another PR for the zstd support

### @francislavoie — 1 reactions  
`👍 1`  ·  [link](https://github.com/caddyserver/caddy/pull/7244#issuecomment-3393426833)

> Huh, we got a data race, that's not good. @DeRuina maybe you have an idea what the problem is?

### @DeRuina — 1 reactions  
`👍 1`  ·  [link](https://github.com/caddyserver/caddy/pull/7244#issuecomment-3406403583)

> @francislavoie [new version available ](https://github.com/DeRuina/timberjack/releases/tag/v1.3.8)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
