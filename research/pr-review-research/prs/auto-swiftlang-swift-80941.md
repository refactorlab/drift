# swiftlang/swift #80941 — [SE-0489] Better `debugDescription` for `EncodingError` and  `DecodingError`

**[View PR on GitHub](https://github.com/swiftlang/swift/pull/80941)**

| | |
|---|---|
| **Author** | @ZevEisenberg |
| **Status** | ✅ merged |
| **Opened** | 2025-04-21 |
| **Repo** | curated review-culture seed |
| **Diff** | +422 / −1 across 6 files |
| **Engagement** | 97 conversation · 50 inline review comments |

## Top review comments (ranked by reactions)

### @stephentyrone — 1 reactions  
`👍 1`  ·  [link](https://github.com/swiftlang/swift/pull/80941#issuecomment-2836438751)

> > @available(SwiftStdlib 6.2, *) is appropriate for current main I believe.
> 
> We've already branched, so if the intention is for this to go into 6.2 it will need a cherry-pick for the [release/6.2 branch](https://github.com/swiftlang/swift/tree/release/6.2) after landing on main. Otherwise, it would get 6.3 availability (which I think someone still has to add)

### @ZevEisenberg — 1 reactions  
`👍 1`  ·  [link](https://github.com/swiftlang/swift/pull/80941#issuecomment-2868441165)

> I've put up a [draft SE proposal](https://github.com/swiftlang/swift-evolution/pull/2843) for these changes. There's an open question related to back-deployment that I could use some advice on.

### @stephentyrone — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/swiftlang/swift/pull/80941#issuecomment-3140949052)

> I'll take responsibility for final sign-off on it. Ping me when you're ready.

### @stephentyrone — 1 reactions  
`👍 1`  ·  [link](https://github.com/swiftlang/swift/pull/80941#issuecomment-3141125027)

> Definitely not 6.2, that's 99.9% baked at this point. 6.3 is likely correct, but we can tweak them when everything else is ready.

### @stephentyrone — 1 reactions  
`👍 1`  ·  [link](https://github.com/swiftlang/swift/pull/80941#issuecomment-3180233339)

> > I think the `allASCII` algorithm changed significantly, which may be great for `-O`, but awful for `-Onone`? CC @stephentyrone on that.
> 
> I would expect it to possibly be somewhat slower, but not catastrophically slow. We really shouldn't even be testing these operations in debug, however, since they only ever are used with -O.

### @ZevEisenberg — 1 reactions  
`👍 1`  ·  [link](https://github.com/swiftlang/swift/pull/80941#issuecomment-3378572466)

> I think I'm ready for a rebuild. I found 64b5bb097724c38bd4bb9cad17325f38a36bf74b by @lorentey, which showed the way forward ❤️


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
