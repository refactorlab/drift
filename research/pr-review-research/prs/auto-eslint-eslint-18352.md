# eslint/eslint #18352 — feat: add suggestions to `no-unused-vars`

**[View PR on GitHub](https://github.com/eslint/eslint/pull/18352)**

| | |
|---|---|
| **Author** | @Tanujkanti4441 |
| **Status** | ✅ merged |
| **Opened** | 2024-04-16 |
| **Repo** | curated review-culture seed |
| **Diff** | +1650 / −221 across 3 files |
| **Engagement** | 16 conversation · 92 inline review comments |

## Top review comments (ranked by reactions)

### @Tanujkanti4441 — 1 reactions  
`👍 1`  ·  [link](https://github.com/eslint/eslint/pull/18352#issuecomment-2182906797)

> sorry! wasn't active due to some work and health issues, working on it.

### @fasttime — 1 reactions  
`👍 1`  ·  [link](https://github.com/eslint/eslint/pull/18352#issuecomment-2198630391)

> Thanks for the update @Tanujkanti4441, I think it's okay to leave that line uncovered if it cannot be reached in a test case. Probably a pattern like `...[a]` or `...{a}` can only appear inside an array destructuring pattern, and so the previous conditional path `if (parentNode.type === "ArrayPattern")` is always taken. You could leave a comment on `return null;` saying that that line should never be reached when using the default parser.

### @christian-bromann — 1 reactions  
`👍 1`  ·  [link](https://github.com/eslint/eslint/pull/18352#issuecomment-2257033092)

> @fasttime taking a look 👀 
> 
> Edit: it doesn't seem like anything related to this PR, I think it will pass if we rerun the task. The error is related to an optimization error on the server side and something we are working on improving.

### @Tanujkanti4441 — 0 reactions  
`—`  ·  [link](https://github.com/eslint/eslint/pull/18352#issuecomment-2068963179)

> @eslint/eslint-team, code in this PR seems to work fine but having linting error that `Method 'fix' expected no return value` can i get some help in figuring out what is wrong or is there something i am not aware of?

### @aladdin-add — 0 reactions  
`—`  ·  [link](https://github.com/eslint/eslint/pull/18352#issuecomment-2068969987)

> It's required to return a value in fixers (to catch possible errors). if you don't want to fix in some cases, please use `return null;`

### @Tanujkanti4441 — 0 reactions  
`—`  ·  [link](https://github.com/eslint/eslint/pull/18352#issuecomment-2072517649)

> > It's required to return a value in fixers (to catch possible errors). if you don't want to fix in some cases, please use `return null;`
> 
> Thanks for reply!
> 
> but is this suggestion also true for the following code?
> ```js
> return fixer.removeRange(parent.parent.range);
> ```
> because it actually returns a value and having error `Method 'fix' expected no return value`


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
