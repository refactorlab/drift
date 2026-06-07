# eslint/eslint #18134 — feat: Add support for TS config files

**[View PR on GitHub](https://github.com/eslint/eslint/pull/18134)**

| | |
|---|---|
| **Author** | @aryaemami59 |
| **Status** | ✅ merged |
| **Opened** | 2024-02-21 |
| **Repo** | curated review-culture seed |
| **Diff** | +1846 / −85 across 44 files |
| **Engagement** | 38 conversation · 111 inline review comments |

## Top review comments (ranked by reactions)

### @mmkal — 5 reactions  
`👍 5`  ·  [link](https://github.com/eslint/eslint/pull/18134#issuecomment-2223413446)

> @aryaemami59 small but important nit on the PR description - it's worth updating this:
> 
> >Adds jiti as a dependency.
> 
> To
> 
> >Adds jiti as an optional peer dependency.
> 
> I spent a bit of time trying to understand @privatenumber's [tweet](https://x.com/privatenumbr/status/1811367174247940170) about this, but was confused as I thought this PR added `jiti` as a prod dependency, then even more confused on reading the RFC, until I checked the Files tab.
> 
> ---
> 
> My two cents: I agree with @privatenumber that it'd be good to support `tsx` as another option. Both have millions of weekly downloads and will likely continue to until node.js is able to run TypeScript directly, and eslint should avoid pushing its opinion on which is a better option if possible (I may be biased in saying this here partly because I'm team `tsx`!)

### @aladdin-add — 2 reactions  
`👍 2`  ·  [link](https://github.com/eslint/eslint/pull/18134#issuecomment-1980242314)

> I think it needs a rfc to evaluate: https://github.com/eslint/rfcs
> 
> My hope:
> * it's opt-in, not default
> * 0-overhead for js users
> * no bind tsx/ts-node/..., worth exploring a standard way to let users make the choice which one to use.

### @aryaemami59 — 2 reactions  
`👍 2`  ·  [link](https://github.com/eslint/eslint/pull/18134#issuecomment-1989677260)

> RFC has been submitted: https://github.com/eslint/rfcs/pull/117

### @antfu — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/eslint/eslint/pull/18134#issuecomment-2198191217)

> Yeah it's amazing that @pi0 managed to get jiti working with top-level await! I don't have a strong opinion between this PR and https://github.com/eslint/eslint/pull/18440, either way would work great, as the main goal is to get TS config supported.
> 
> I would (biasedly) lean a bit towards `importx` as `jiti` v2 is still in beta. After the stable is out, `importx` would upgrade to it, absorb the API changes, and directly make it work for older Node.js versions without the ESLint to take care of that.

### @pi0 — 2 reactions  
`👍 2`  ·  [link](https://github.com/eslint/eslint/pull/18134#issuecomment-2233441293)

> Hi all! Sorry I'm little bit busy as moving multiple things forward. In final beta of jiti, i plan to add export conditions for runtimes that natively support ts (Bun, Deno) + lazy loading. This together would perhaps both make eslint integration simpler and also faster.
> 
> But regardless, do feel free to iterate just sharing upcoming plans before jiti v2.

### @fasttime — 1 reactions  
`👍 1`  ·  [link](https://github.com/eslint/eslint/pull/18134#issuecomment-2133341724)

> Thanks for working on this, @aryaemami59! In order to move forward with this pull request, we will need some unit tests to verify that TypeScript config files are being loaded as expected.
> 
> My suggestion would be to start looking at [these tests](https://github.com/eslint/eslint/blob/a63ed722a64040d2be90f36e45f1f5060a9fe28e/tests/lib/eslint/eslint.js#L843-L920) and add similar tests to check the behavior with packages that have config files with `.ts`, `.cts` and `.mts` extension in place of `.js`, `.cjs` and `.mjs` respectively. It would be also useful to have a test that checks loading a config file whose path is specified in `overrideConfigFile` like [this one](https://github.com/eslint/eslint/blob/a63ed722a64040d2be90f36e45f1f5060a9fe28e/tests/lib/eslint/eslint.js#L950-L961). When you are done, just mark the PR as ready for review. Feel free to ping me if you need any help.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
