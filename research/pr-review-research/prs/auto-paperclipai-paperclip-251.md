# paperclipai/paperclip #251 — fix(heartbeat): prevent false process_lost failures on queued and non-child-process runs

**[View PR on GitHub](https://github.com/paperclipai/paperclip/pull/251)**

| | |
|---|---|
| **Author** | @mjaverto |
| **Status** | ✅ merged |
| **Opened** | 2026-03-07 |
| **Repo importance** | ★69,213 · 12,841 forks · score 125,572 |
| **Diff** | +70 / −14 across 4 files |
| **Engagement** | 15 conversation · 10 inline review comments |

## Top review comments (ranked by reactions)

### @mjaverto — 0 reactions  
`—`  ·  [link](https://github.com/paperclipai/paperclip/pull/251#issuecomment-4017562728)

> Also addressed the indentation inconsistency noted in the Greptile summary: re-indented `let seq`, `let handle`, `let stdoutExcerpt`, `let stderrExcerpt`, and the inner `try/catch` block to consistent 8-space depth inside the outer `try` body.

### @cryppadotta — 0 reactions  
`—`  ·  [link](https://github.com/paperclipai/paperclip/pull/251#issuecomment-4018136112)

> This looks great but hits the core of the heartbeat with a lot of lines so I'd like a couple testers to confirm this fixes it for them. 
> 
> Also it has a merge conflict that needs resolved

### @mjaverto — 0 reactions  
`—`  ·  [link](https://github.com/paperclipai/paperclip/pull/251#issuecomment-4019666209)

> @prodij Rebased on master and conflicts are resolved. The two conflict sites were `server/package.json` (adapter-openclaw was removed upstream) and `server/src/services/heartbeat.ts` (integrated the `secretKeys` redaction from #261).
> 
> Re: interactions with #277 (auto-requeue) — the changes here should compose cleanly. `reapOrphanedRuns` now scopes strictly to `running` status, `resumeQueuedRuns` re-drives persisted `queued` work, and the outer catch prevents setup failures from leaving runs stuck. Each operates on a distinct lifecycle state, so auto-requeue logic can layer on top without conflict.

### @ggonzalez94 — 0 reactions  
`—`  ·  [link](https://github.com/paperclipai/paperclip/pull/251#issuecomment-4041574113)

> would be great to get this fixed. False process_lost is the number 1 issue I have in paperclip today

### @0xfulgore — 0 reactions  
`—`  ·  [link](https://github.com/paperclipai/paperclip/pull/251#issuecomment-4042875544)

> can this get merged in and a release done?

### @gsxdsm — 0 reactions  
`—`  ·  [link](https://github.com/paperclipai/paperclip/pull/251#issuecomment-4052364771)

> I tested this and it seems to have fixed my process_lost issues - highly recommend this gets merged @cryppadotta


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
