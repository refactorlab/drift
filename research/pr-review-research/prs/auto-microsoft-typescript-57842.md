# microsoft/TypeScript #57842 — Region-based semantic diagnostics

**[View PR on GitHub](https://github.com/microsoft/TypeScript/pull/57842)**

| | |
|---|---|
| **Author** | @gabritto |
| **Status** | ✅ merged |
| **Opened** | 2024-03-19 |
| **Repo** | curated review-culture seed |
| **Diff** | +4872 / −927 across 161 files |
| **Engagement** | 35 conversation · 70 inline review comments |

## Top review comments (ranked by reactions)

### @jakebailey — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/TypeScript/pull/57842#issuecomment-2010918816)

> I haven't gone through the whole thing yet, but one thing we may want to do (maybe just for this PR's development and not long term) is to try and run this request at random positions before running compiler tests or similar. The thinking being that it shouldn't affect the analysis to do that. We had a fuzzer like this in pyright and it found loads of bugs in the type evaluator / checker that we were only previously able to observe via people crashing or reporting bugs we couldn't figure out.

### @gabritto — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/TypeScript/pull/57842#issuecomment-2166817434)

> @typescript-bot user test tsserver
> @typescript-bot test tsserver top200
> @typescript-bot perf test this

### @gabritto — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/TypeScript/pull/57842#issuecomment-2018754127)

> So far I locally tested this on the top 200 TS repos (relying on ts-error-deltas). Nothing crashed, I tested normal semantic diagnostics vs region-based semantic diagnostics on 1690 random files with at least 400 lines, at random positions, before and after deleting a random character. Average time for whole file semantic diagnostics was 198ms vs 120ms for region-based semantic diagnostics with a single range of 200 lines.
> 
> Reminder to myself: I'm going to check that the diagnostics themselves didn't change unexpectedly when using region-based diagnostics vs not using it during these tests, and I'll post updates here.
> I also need to post results comparing diagnostics for large files (e.g. `checker.ts`).

### @gabritto — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/TypeScript/pull/57842#issuecomment-2021859708)

> I found enough weird error inconsistencies that I have to investigate to feel suspicious about this PR, so, drafting it again.

### @gabritto — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/TypeScript/pull/57842#issuecomment-2093825697)

> Update on diagnostics inconsistencies:
> I'm working on fixing the position inconsistencies and the type comparison elaboration inconsistencies; they'll be separate, follow-up PRs.

### @gabritto — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/TypeScript/pull/57842#issuecomment-2123315100)

> Heads up when reviewing: commit https://github.com/microsoft/TypeScript/pull/57842/commits/a3cdc74908d69ebc00e7405f1483d88f65e91d4a updates around 100 unit test logs with the new diagnostics event property `"duration"`, properly sanitized. It might be easier to review that one separately.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
