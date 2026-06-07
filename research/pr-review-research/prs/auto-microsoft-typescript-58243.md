# microsoft/TypeScript #58243 — Add TReturn/TNext to Iterable et al

**[View PR on GitHub](https://github.com/microsoft/TypeScript/pull/58243)**

| | |
|---|---|
| **Author** | @rbuckton |
| **Status** | ✅ merged |
| **Opened** | 2024-04-18 |
| **Repo** | curated review-culture seed |
| **Diff** | +3476 / −1056 across 163 files |
| **Engagement** | 129 conversation · 43 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @rbuckton — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/TypeScript/pull/58243#issuecomment-2117780070)

> @typescript-bot run dt
> @typescript-bot test top400
> @typescript-bot test tsserver top100
> @typescript-bot user test this
> @typescript-bot user test tsserver

### @rbuckton — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/TypeScript/pull/58243#issuecomment-2120929151)

> @typescript-bot run dt
> @typescript-bot test top400
> @typescript-bot test tsserver top100
> @typescript-bot user test this
> @typescript-bot user test tsserver

### @rbuckton — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/TypeScript/pull/58243#issuecomment-2123149624)

> @typescript-bot run dt
> @typescript-bot test top400
> @typescript-bot test tsserver top100
> @typescript-bot user test this
> @typescript-bot user test tsserver

### @rbuckton — 1 reactions  
`👀 1`  ·  [link](https://github.com/microsoft/TypeScript/pull/58243#issuecomment-2123483172)

> Based on the last two runs, the following is a summary of the differences between `undefined` vs `void` as `TReturn` for built-in iterators across DT, our user tests, and the top 400 repos:
> 
> 1. `undefined`
>    1. ✔️ Can be forcibly ignored using postfix-`!`
>    2. ❌ Requires an argument to call `iter.return()`.
>       - See `graphql/graphql-js` in https://github.com/microsoft/TypeScript/pull/58243#issuecomment-2121081910
>    3. ✔️ No problem with assignability to `T | undefined`.
>    4. ❌ Assignability errors in interface implementations and subclasses.
>       - See `effect` in https://github.com/microsoft/TypeScript/pull/58243#issuecomment-2120971326
> 2. `void`
>    1. ✔️ Can be forcibly ignored using postfix-`!`
>    2. ✔️ Doesn't require an argument to call `iter.return()`.
>    3. ❌ `T | void` is not assignable to `T | undefined`.
>       - See `backstage/backstage` in https://github.com/microsoft/TypeScript/pull/58243#issuecomment-2123353315
>       - See `ionic-team/ionic-framework` in https://github.com/microsoft/TypeScript/pull/58243#issuecomment-2123353315
> 
> I think the assignability issues in (1.iv) are far more problematic than those in (2.iii), as those in (2.iii) can be addressed with postfix-`!`, while those in (1.iv) cannot. This leads me to believe that continuing to use `void` over `undefined` as the return type for built-in iterators is probably the correct direction.

### @rbuckton — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/TypeScript/pull/58243#issuecomment-2189951519)

> > It doesn't look like the assignability error in iv. is genuine.
> > * Digging through [the pipeline output](https://typescript.visualstudio.com/TypeScript/_build/results?buildId=161815&view=logs&j=98775127-73cc-5696-36a2-d2fef8930518&t=d9d396e3-92f1-565f-9165-fe54ddb28c95&l=381), the number of errors from the compilation hasn't changed. What's happened is that the mismatched types causing these errors have changed from `Effect<void, unknown, unknown>` to `Effect<undefined, unknown, unknown>` due to the change in generator fallback return type, and this is being reported by the workflow as a "new" error.
> 
> It is not just `effect`, there are also assignability errors for fp-ts, puppeteer, and webpack.

### @rbuckton — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/TypeScript/pull/58243#issuecomment-2190206985)

> @typescript-bot run dt
> @typescript-bot test top400
> @typescript-bot test tsserver top100
> @typescript-bot user test this
> @typescript-bot user test tsserver


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
