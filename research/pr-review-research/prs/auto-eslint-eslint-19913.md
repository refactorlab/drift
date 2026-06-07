# eslint/eslint #19913 — feat: add `preserve-caught-error` rule

**[View PR on GitHub](https://github.com/eslint/eslint/pull/19913)**

| | |
|---|---|
| **Author** | @Amnish04 |
| **Status** | ✅ merged |
| **Opened** | 2025-07-04 |
| **Repo** | curated review-culture seed |
| **Diff** | +1484 / −7 across 13 files |
| **Engagement** | 14 conversation · 113 inline review comments |

## Top review comments (ranked by reactions)

### @nzakas — 1 reactions  
`👍 1`  ·  [link](https://github.com/eslint/eslint/pull/19913#issuecomment-3108909417)

> I think `disallowUncaughtErrors` is a bit difficult to understand due to the double negative. How about `requireCatchParameter` instead?

### @nzakas — 1 reactions  
`👍 1`  ·  [link](https://github.com/eslint/eslint/pull/19913#issuecomment-3188870610)

> Nice catch, I agree that highlighting just the throws is a better user experience. I would still highlight both.

### @Amnish04 — 1 reactions  
`👍 1`  ·  [link](https://github.com/eslint/eslint/pull/19913#issuecomment-3246069150)

> @fasttime Thanks for all the detailed follow ups! Excited to see this in the next release ^^

### @Amnish04 — 0 reactions  
`—`  ·  [link](https://github.com/eslint/eslint/pull/19913#issuecomment-3037181544)

> Not sure why, I am getting CI issues with my `further_reading` links:
> 
> ```
> Problem writing Eleventy templates:
> [11ty] 1. Having trouble writing to "./_site/rules/preserve-caught-error.html" from "./src/rules/preserve-caught-error.md" (via EleventyTemplateError)
> [11ty] 2. (./src/_includes/layouts/doc.html)
> [11ty]  (/home/runner/work/eslint/eslint/docs/src/_includes/components/docs-index.html)
> [11ty]  (/home/runner/work/eslint/eslint/docs/src/_includes/components/search.html)
> [11ty]   EleventyNunjucksError: Error with Nunjucks shortcode `link` (via Template render error)
> [11ty] 3. Data missing for https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
> ```
> 
> Although I see MDN links being used in docs of some existing rules:
> https://github.com/Amnish04/eslint/blob/99b3c2926152b972782a4eec8f06dea7177ccb04/docs/src/rules/class-methods-use-this.md#L4-L7

### @Amnish04 — 0 reactions  
`—`  ·  [link](https://github.com/eslint/eslint/pull/19913#issuecomment-3042808708)

> @fasttime Thanks for your help!
> 
> As per you review, I have:
> 1. Added a [type definition](https://github.com/eslint/eslint/pull/19913/commits/0601c51b6b3d42bcef29e699acaf7e1d255f4038) for `preserve-caught-error` rule and generated a tsdoc comment for it.
> 2. [Added](https://github.com/eslint/eslint/pull/19913/commits/acc4843201cbf6b8f49a6a6f8daa12e24875f3cf) my "further reading" links metadata to `further_reading_links.json` file.
> 3. Updated the [error message](https://github.com/eslint/eslint/pull/19913/commits/4dcba70755f48390796acfae15753af35d769cd9) for when further links metadata is missing.
> 
> All CI checks are passing and the branch is up-to-date with upstream main. Please let me know if you see any more issues!

### @Amnish04 — 0 reactions  
`—`  ·  [link](https://github.com/eslint/eslint/pull/19913#issuecomment-3042857595)

> I've also marked this rule as `recommended` as it is widely applicable and a general best practice to adhere to. But please let me know if people have different thoughts and I'll undo it.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
