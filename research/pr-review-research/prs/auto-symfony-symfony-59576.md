# symfony/symfony #59576 — [HttpClient] Make `CachingHttpClient` compatible with RFC 9111

**[View PR on GitHub](https://github.com/symfony/symfony/pull/59576)**

| | |
|---|---|
| **Author** | @Lctrs |
| **Status** | ✅ merged |
| **Opened** | 2025-01-21 |
| **Repo** | curated review-culture seed |
| **Diff** | +1914 / −99 across 17 files |
| **Engagement** | 15 conversation · 90 inline review comments |

## Top review comments (ranked by reactions)

### @nicolas-grekas — 8 reactions  
`👍 3 · ❤️ 5`  ·  [link](https://github.com/symfony/symfony/pull/59576#issuecomment-3345378226)

> Months of work, congrats for the achievement!

### @stof — 1 reactions  
`👍 1`  ·  [link](https://github.com/symfony/symfony/pull/59576#issuecomment-2607248529)

> Can we bring this to CachingHttpClient (with a BC layer) instead of introducing a new class that is the good implementation of caching but with a name that is much less clear ?
> Also, having the RFC id in the class name is a bad idea to me, as it would be a pain if a new RFC gets released to replace the current one (which happened multiple times for RFCs related to HTTP)

### @Lctrs — 1 reactions  
`👍 1`  ·  [link](https://github.com/symfony/symfony/pull/59576#issuecomment-3258220941)

> I'm currently on holiday. I'll get back to it next week. Including my thoughts on possible race conditions discussed earlier. 
> 
> > Can you please maybe expand in the PR description? Think about a blog post we could derive from it :)
> 
> May you be more specific ? You want me to explain the code ?

### @Lctrs — 1 reactions  
`👍 1`  ·  [link](https://github.com/symfony/symfony/pull/59576#issuecomment-3268206708)

> @nicolas-grekas Done. Hope it's what you had in mind.
> 
> About concurrent requests, due to the async nature of the implementation - and unless I'm missing something -, wrapping everything in a `$cache->get()` call won't do the trick. We may have to bring `symfony/lock` to the party to implement request coalescing.

### @Lctrs — 0 reactions  
`—`  ·  [link](https://github.com/symfony/symfony/pull/59576#issuecomment-2668379060)

> UPDATE:
> - CI failure on PHP 8.5 is unrelated
> - Psalm failure seems to be a false positive to me
> - Tests pass locally on low deps, but not on github actions. I need to look at it.
> - I don't know how to please fabbot. Should I not make any change to the upgrade file ?
> 
> Otherwise, PR is ready on my side. Ready for another reviews.

### @nicolas-grekas — 0 reactions  
`—`  ·  [link](https://github.com/symfony/symfony/pull/59576#issuecomment-2812171528)

> Not sure about locking as a first step, maybe just some pointer would be enough: while writing, we use some random key name, and once the cache is populated, we update some other pointer key, this one predictably derived from the request. When the cache is stale or empty, that'd mean writing many concurrent streams to the cache backend for the same request, until one finished and wins of the others. No ideal, but at least correct from a behavioral perspective.
> The next step would be to wrap everything in one may $cache->get() callback, which would the act as the lock unit, possibly capable of serving something while revalidating and/or waiting/streaming while the concurrent write thread is doing its job. I'd be fine doing this next step in a follow up PR if that's too involving for this one.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
