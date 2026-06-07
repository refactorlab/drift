# microsoft/TypeScript #61505 — Cache mapper instantiations

**[View PR on GitHub](https://github.com/microsoft/TypeScript/pull/61505)**

| | |
|---|---|
| **Author** | @Andarist |
| **Status** | ✅ merged |
| **Opened** | 2025-03-30 |
| **Diff** | +5,474 / −81 across 90 files |
| **Engagement** | 68 conversation comments · 3 inline review comments |

## Why this PR is notable

A compiler performance fix caching mapper instantiations. `Andarist` supplies **before/after numbers from a real tRPC repo** (798 MB → …, 13s check time); `ahejlsberg` posts a **root-cause analysis** of exponential expansion in nested types — and pushes back that caching only halves a problem that grows exponentially.

## 🧠 The lesson for reviewers

> Performance review runs on **measured numbers + root-cause reasoning**. The sharpest reviewers ask whether a fix bends the actual growth curve or just shifts the constant.

## How the author framed it (PR description excerpt)

> @ssalbdivad found out that a chain of somewhat trivial operations can easily end up with dreaded "Type instantiation is excessively deep and possibly infinite".
> 
> Two different reproductions were created:
> 1. standalone signature receiving its previous output as input in a chain: [TS playground](https://www.typescriptlang.org/play/?ts=5.9.0-dev.20250326#code/KYDwDg9gTgLgBDAnmYcC2woHNgB4BGAhgM7AA0cYUEYxAfHALxwDyaAljASeXANbBEEAGaVqtOADJ+gkXCKkG0qjWIBuAFAaAJsADGAG0JRUeiADti8DNmAAuOLgMUodABQGHzuFAdQAlEwMNjhOLnSaGmaW8BAAjEzomDhuAN6UcQ4JAL4U6WAATA4FcNn+mtFWcBAlzCHAbvF5lADMDi2l5VEWVRAddckNNc1gACwOo50VPbGTA7aNLSMArA7LU90x1evzKRCjIwBsDocblbGnu0PLIwDsDrdnM9WPV42HIwAcDp9PWxC-N4QW4jACcDlBf16kKBnxGcQADFkEVDYojEvVGqD4Zk4HEcl1ztV8RjBo1EfCiniSmVpv84rUkgt4nF4W08R1aZtenF+ky9gz4eM8ZMuUT4nN+UNefDVnj1mLnvEdlLyQc4Pk4sc8adFfTLqrlfD7njHnqea9DVr4d88b9zWjAVaQRqMuC8ZCHcSYVa4a7Cki4AUUV6aiigXFsf6CriY6jqnGgcGRgUqan4zVGZiaqzo+yCpzCUqC6TmamU8KCqKi-8q6W9gWU3KCgqa70W-WhlWU9qCrq27E+53Gi2UyaCmaBwnLdm+ynbQV7VOak7Zy78gV3ZuM9uk378i1A4eM8ek1GD7iWgS6b0r8O+giRi0qc+T1myX1cwf2S1CzfYr+97Pk+wotNW-7VGBQFLP6LRynBJ4qtmYFPtqLT9hBfQGshNywSaLSTphBFAR8sG2i0S5EauH4EU+7otJ6y4MUB+6UKMgbsRmnFAgxIyjLi-FcQkQLsXxVKjDSy4Sfe-F8eyox-tysx8tmEl8cKozgUp1SaTJMH5KMcqGVxSEfppfHaqMGHafs2FmbhBkmqMhE2c5MmkQZtqjJRrnUcyzl8e6oyMZhwUyaxYDLIGUUZjFInnpQyy4klGwaPEAB0YBxJoGWRdlcAAPQFXAmDUFAWg1Jl2VpQUmUFDltVgC0DWZaMaiFcVpXQBVLZVQ1yxVQi-V1YckQPn1aWHplV45VNTWfO1RUlVAZWTQimVJYtnUrd1aVRRNED7U11WHet805Udm0aEAA)
> 2. a dotted chain where a method returns a new instance of its own enclosing type alias: [TS playground](https://www.typescriptlang.org/play/?ts=5.9.0-dev.20250326#code/C4TwDgpgBAthBOBzCAeARgQwM4QDRTHgHswsA+KAXigHkYBLYdbPKAawhCIDMDjSoAMnaceUTDgrDCJLAG …​ *[truncated]*

## Highest-signal comments (ranked by reactions)

### @Andarist — 71 reactions  
`❤️ 53 · 🚀 18`  ·  [link](https://github.com/microsoft/TypeScript/pull/61505#issuecomment-2769065243)

> @ssalbdivad tested this in a trpc-based repo.
> 
> TS 5.8:
> ```
> Types:                       139629
> Instantiations:            12133763
> Memory used:                798162K
> Check time:                  13.04s
> ```
> 
> This branch (commit [b0f5c70](https://github.com/microsoft/TypeScript/pull/61505/commits/b0f5c703072ab9ea97d73176f379014e2e28048d)):
> ```
> Types:                      139629
> Instantiations:             817105
> Memory used:               819990K
> Check time:                  6.00s
> ```


### @ahejlsberg — 47 reactions  
`👍 12 · ❤️ 23 · 🎉 6 · 🚀 6`  ·  [link](https://github.com/microsoft/TypeScript/pull/61505#issuecomment-2800012653)

> I've researched the issue a bit. The core problem is that we enter into an exponential expansion when instantiating deeply nested types like `merge<merge<merge<merge<...>, ...>, ...>, ...>` and their associated alias type argument lists. Most of these instantiations do nothing at all because there are no free type variables in the type arguments, but we lack logic with enough sophistication to realize this (i.e. `couldContainTypeVariables` isn't smart enough). The additional caching introduced in the PRs isn't really a fix--it cuts the number of instantiations in half, but that doesn't help much when we're dealing with exponential growth.
> 
> I think a simpler solution is to make the `merge` type a little smarter. The following formulation eliminates the problem in the repro:
> 
> ```ts
> type merge<T, U> = keyof T & keyof U extends never ? T & U : Omit<T, keyof T & keyof U> & U;
> ```
> 
> It turns merges into simple intersections when the types have no overlapping properties. I would imagine this is often the case, but I'm not sure.
> 
> Earlier I mentioned this formulation, but unfortunately that also gets exponentially slow:
> 
> ```ts
> type merge<T, U> = { [P in keyof T | keyof U]: P extends keyof U ? U[P] : T[P & keyof T] };
> ```


### @Andarist — 24 reactions  
`👍 14 · ❤️ 10`  ·  [link](https://github.com/microsoft/TypeScript/pull/61505#issuecomment-2809066483)

> > The additional caching introduced in the PRs isn't really a fix--it cuts the number of instantiations in half, but that doesn't help much when we're dealing with exponential growth.
> 
> I'm not sure I understand this - thanks to this caching the mentioned expontential growth is mitigated or perhaps even avoided - because the cache gets hit before it has a chance to hit this exponential spiral. It *substantially* reduces check times - so it's not only about cutting instantiation counts.
> 
> > I think a simpler solution is to make the merge type a little smarter. The following formulation eliminates the problem in the repro
> 
> I have couple of concerns when it comes to this recommendation:
> 1. It assumes users would be able to figure this out as a solution and that requires pinpointing the problem to a specific type like this in the first place - which isn't an easy thing to do. We have pinpointed this particular problem to a library code, so we could update this in their types and many people would benefit from it. It's not universally true for all such `merge`s in the wild and I don't think this kind of an optimization should become something shared by the word of mouth.
> 2. There are issues with the proposed `merge` alternatives:
> - the first one introduces a fast path for a common case (I like it!) but it would still suffer from the same issue if there would be some overlapping keys within "layers" of consecutive `merge`s
> - the second one breaks property symbol declaration links, see the TS playground [here](https://www.typescriptlang.org/play/?ts=5.8.3#code/C4TwDgpgBAthBOBzCBGAPAFQDRQKoD4oBeKAeRgEthMcBrCEAewDMoMoAyKep1gzvAG4AUKEiwEyAEw08hEjxZsBivlAgAPYBAB2AEwDOUHRABuCKAH5lXXFAB …​ *[truncated]*


### @mikeduminy — 18 reactions  
`👍 11 · ❤️ 5 · 🚀 2`  ·  [link](https://github.com/microsoft/TypeScript/pull/61505#issuecomment-3102636519)

> This was a game-changer PR for us. Thank you!
> 
> | | Before | After | Improvement |
> | -------- | -------- | -------- | --------
> | Instantiations | 704,556,467 | 10,119,793 | 98.56% |
> | Check time | 395.48 | 132.09 | 66.60% |
> | Total time | 425.86 | 164.77 | 61.31% |


---
*Data pulled live from the GitHub REST API. Reaction counts are a snapshot at fetch time.*
