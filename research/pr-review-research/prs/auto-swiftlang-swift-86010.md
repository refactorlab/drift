# swiftlang/swift #86010 — Rework ForEachStmt Desugaring

**[View PR on GitHub](https://github.com/swiftlang/swift/pull/86010)**

| | |
|---|---|
| **Author** | @elsakeirouz |
| **Status** | ✅ merged |
| **Opened** | 2025-12-12 |
| **Repo** | curated review-culture seed |
| **Diff** | +1262 / −1343 across 75 files |
| **Engagement** | 28 conversation · 139 inline review comments |

## Top review comments (ranked by reactions)

### @elsakeirouz — 0 reactions  
`—`  ·  [link](https://github.com/swiftlang/swift/pull/86010#issuecomment-3745919444)

> Note: the first 3 commits come from #86537 . Will therefore need to rebase again once that PR lands

### @elsakeirouz — 0 reactions  
`—`  ·  [link](https://github.com/swiftlang/swift/pull/86010#issuecomment-3746007334)

> @swift-ci please test source compatibility

### @elsakeirouz — 0 reactions  
`—`  ·  [link](https://github.com/swiftlang/swift/pull/86010#issuecomment-3751048630)

> @swift-ci please test source compatibility

### @hamishknight — 0 reactions  
`—`  ·  [link](https://github.com/swiftlang/swift/pull/86010#issuecomment-3751626087)

> @swift-ci please test source compatibility

### @hamishknight — 0 reactions  
`—`  ·  [link](https://github.com/swiftlang/swift/pull/86010#issuecomment-3754140236)

> @swift-ci please test source compatibility Release

### @hamishknight — 0 reactions  
`—`  ·  [link](https://github.com/swiftlang/swift/pull/86010#issuecomment-3756550578)

> ### Performance (x86_64): -O
> 
> **Regression**                            | **OLD**    | **NEW**    | **DELTA** | **RATIO**
> :---                                      | ---:       | ---:       | ---:      | ---:     
> NSString.bridged.byteCount.ascii.macroman | 0.0        | 0.678      | +67800.0% | **0.00x (?)**
> CxxStringConversion.cxx.to.swift          | 86.75      | 149.0      | +71.8%    | **0.58x (?)**
> Data.hash.Medium                          | 32.569     | 40.317     | +23.8%    | **0.81x**
> ObjectiveCBridgeStubDateAccess            | 154.625    | 184.692    | +19.4%    | **0.84x (?)**
> InsertCharacterEndIndex                   | 85.423     | 96.273     | +12.7%    | **0.89x (?)**
> Dictionary3OfObjects                      | 329.25     | 368.0      | +11.8%    | **0.89x**
> Prims.NonStrongRef.UnownedSafe            | 525.5      | 568.333    | +8.2%     | **0.92x (?)**
> Prims.NonStrongRef.UnownedSafe.Closure    | 525.5      | 568.0      | +8.1%     | **0.93x (?)**
> PrefixArrayLazy                           | 16.977     | 18.313     | +7.9%     | **0.93x (?)**
> &nbsp; | | | | 
> **Improvement**                           | **OLD**    | **NEW**    | **DELTA** | **RATIO**
> Dictionary4                               | 221.375    | 184.444    | -16.7%    | **1.20x (?)**
> Monoids                                   | 20563442.0 | 17607031.0 | -14.4%    | **1.17x (?)**
> StringAdder                               | 381.167    | 333.714    | -12.4%    | **1.14x (?)**
> StringDistance.scalars.ascii              | 587.25     | 522.5      | -11.0%    | **1.12x (?)**
> RomanNumbers2 … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
