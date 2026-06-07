# microsoft/TypeScript #58201 — Isolated declarations errors

**[View PR on GitHub](https://github.com/microsoft/TypeScript/pull/58201)**

| | |
|---|---|
| **Author** | @dragomirtitian |
| **Status** | ✅ merged |
| **Opened** | 2024-04-15 |
| **Repo** | curated review-culture seed |
| **Diff** | +13230 / −35 across 121 files |
| **Engagement** | 15 conversation · 98 inline review comments |

## Top review comments (ranked by reactions)

### @weswigham — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/TypeScript/pull/58201#issuecomment-2066924789)

> > Caching the result of the syntactic check. I don't think I can address this until tomorrow. I think it would be better to think about this once the syntactic builder actually produces nodes and see about caching those. https://github.com/microsoft/TypeScript/pull/58201#discussion_r1566231093
> 
> It's not critical, it'll probably just be good for perf in the normal command-line compile case.
> 
> > shouldPrintWithInitializer change - I can revert this. The old version sometimes returned true for constants that are annotated. This should not happen, am external tool would use the explicit annotation. This might be more in the emit alignment category, so I can open a PR with it after the beta. https://github.com/microsoft/TypeScript/pull/58201#discussion_r1567835558
> 
> I do think the existing emit is odd, but this is definitely something we should consider separately, as potentially weirdly breaking and not scoped to isolated declarations. Let's split that into a separate PR.
> 
> > remove NoSyntacticPrinter - Any changes I make around this would be temporary as this flag is not needed in the final version. I did make a suggestion that I could implement to make it better for now. https://github.com/microsoft/TypeScript/pull/58201#discussion_r1570995658
> 
> From here, for now, I'd say just apply [this change](https://github.com/weswigham/TypeScript/commit/f05f91c4a8c4a29d6676df0130a9de4d07aa34ee.patch), and we can revisit as functionality changes. That's all I was getting at before.

### @dragomirtitian — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/TypeScript/pull/58201#issuecomment-2066545883)

> I think I addressed most comments. The ones that remain I don't feel are actionable:
> 
> 1. Caching the result of the syntactic check. I don't think I can address this until tomorrow. I think it would be better to think about this once the syntactic builder actually produces nodes and see about caching those. [link](https://github.com/microsoft/TypeScript/pull/58201#discussion_r1566231093)
> 
> 2. `shouldPrintWithInitializer` change - I can revert this. The old version sometimes returned true for constants that are annotated. This should not happen, am external tool would use the explicit annotation. This might be more in the emit alignment category, so I can open a PR with it after the beta. [link](https://github.com/microsoft/TypeScript/pull/58201#discussion_r1567835558)
> 
> 3. remove `NoSyntacticPrinter` - Any changes I make around this would be temporary as this flag is not needed in the final version. I did make a suggestion that I could implement to make it better for now. [link](https://github.com/microsoft/TypeScript/pull/58201#discussion_r1570995658)

### @jakebailey — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/TypeScript/pull/58201#issuecomment-2067272622)

> I left some unused code behind, sorry :(
> 
> Shouldn't affect benchmarks, so
> 
> @typescript-bot perf test this


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
