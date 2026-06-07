# TanStack/query #7988 — feat: add support for `React.use()`

**[View PR on GitHub](https://github.com/TanStack/query/pull/7988)**

| | |
|---|---|
| **Author** | @KATT |
| **Status** | ✅ merged |
| **Opened** | 2024-08-30 |
| **Repo importance** | ★49,637 · 3,868 forks · score 70,087 |
| **Diff** | +1299 / −39 across 21 files |
| **Engagement** | 28 conversation · 40 inline review comments |

## Top review comments (ranked by reactions)

### @TkDodo — 2 reactions  
`🎉 2`  ·  [link](https://github.com/TanStack/query/pull/7988#issuecomment-2386343433)

> since the whole feature is experimental (you need to opt into `experimental_prefetchInRender` for it to work), we can ship it and iterate later :tada:

### @TkDodo — 1 reactions  
`👀 1`  ·  [link](https://github.com/TanStack/query/pull/7988#issuecomment-2324675813)

> regarding the other failing tests: vitest seems to now pick up on the rejected promises and reports them as Unhandled Rejection. I'm not yet sure why they would bubble up 🤔 . Good test to start at in the query-core is this one:
> 
> https://github.com/TanStack/query/blob/50315acbb39d0c18dbb8343bfd2e13c1ac588b6f/packages/query-core/src/__tests__/query.test.tsx#L838
> 
> I can confirm that commenting out this line makes it work:
> 
> https://github.com/TanStack/query/pull/7988/files#diff-144cf89d34f29ea1e30da14ec1cd6c323b645d0d446435aa1373b7d0fa00ccbcR605

### @TkDodo — 1 reactions  
`🎉 1`  ·  [link](https://github.com/TanStack/query/pull/7988#issuecomment-2348565898)

> I will talk with @Ephem about this next week

### @TkDodo — 1 reactions  
`🚀 1`  ·  [link](https://github.com/TanStack/query/pull/7988#issuecomment-2350984194)

> I added some more tests where I wasn't sure if that will work, but it does 👏 .
> 
> I will discuss this PR with @Ephem next week but I think we can ship it then. I might want to rename the feature flag to `experimental_autoPrefetching` or something like that, because you can theoretically turn it on without ever using the promise, and it will give you auto prefetching during rendering.

### @Ephem — 1 reactions  
`👍 1`  ·  [link](https://github.com/TanStack/query/pull/7988#issuecomment-2353711234)

> > Thoughts @Ephem ?
> 
> I think I need to marinate this a bit. I mean, on one hand it should be "safe" to do. On the other, is it always desirable? I'm thinking about (future) cases like pre-rendering, the `<Offscreen>` API etc. Probably? But maybe not if a router prerenders all possible routes based on Links on a page? Will devs need some more control (prefetch, but not if this is a prerender).
> 
> If there are any issues there, I fully expect `usePrefetchQuery` to have the same ones, but at least that's more explicit. I think that's mostly an argument for not aiming to make this the "default" behaviour though and a big part of me wants to say this is a nice little optimisation and we can tackle any challenges when they come up. 😄

### @TkDodo — 1 reactions  
`👍 1`  ·  [link](https://github.com/TanStack/query/pull/7988#issuecomment-2353775277)

> > If there are any issues there, I fully expect usePrefetchQuery to have the same ones
> 
> yes, this auto_prefetching was pretty much taken from the `usePrefetchQuery` implementation. I think we are aligned that we could keep it as an experimental flag though, and that you need to turn it on to be able to `use(promise)`, which makes the whole promise feature experimental, too :)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
