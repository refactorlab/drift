# eslint/eslint #18784 — docs: add tabs to cli code blocks

**[View PR on GitHub](https://github.com/eslint/eslint/pull/18784)**

| | |
|---|---|
| **Author** | @Jay-Karia |
| **Status** | ✅ merged |
| **Opened** | 2024-08-18 |
| **Repo** | curated review-culture seed |
| **Diff** | +659 / −307 across 17 files |
| **Engagement** | 46 conversation · 124 inline review comments |

## Top review comments (ranked by reactions)

### @Tanujkanti4441 — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/eslint/eslint/pull/18784#issuecomment-2368751453)

> > @Tanujkanti4441 Sorry for the inconvenience due to minor errors. 😥
> 
> That's completely fine! code is looking nice by the way.

### @harish-sethuraman — 1 reactions  
`👍 1`  ·  [link](https://github.com/eslint/eslint/pull/18784#issuecomment-2295253844)

> You should mark the content as safe to disable encoding. `{{ params.npm | safe}}`

### @harish-sethuraman — 1 reactions  
`👍 1`  ·  [link](https://github.com/eslint/eslint/pull/18784#issuecomment-2297005932)

> There would be two types of tabs for code blocks one being installation and another being the runner.
> 
> The installation one takes multiple params like if it needs to be global installation, what package to install, if it is a dev dep etc..
> 
> so basically this code: 
> ```
> {{{ install_tabs({
>     global: true,
>     package: "eslint"
> }) }}
> ```
> will be resolved to
> 
> ```
> npm i eslint -g
> yarn add eslint -g
> etc..
> ```
> 
> similarly for runners we will have the command that has to be run and the args that command takes. So we should auto generate it for all type of runners npx, bunx etc..

### @nzakas — 1 reactions  
`👀 1`  ·  [link](https://github.com/eslint/eslint/pull/18784#issuecomment-2299014027)

> These are also very simple mappings from one package manager to another. We don't need any other packages to do the translation for us.

### @nzakas — 1 reactions  
`👍 1`  ·  [link](https://github.com/eslint/eslint/pull/18784#issuecomment-2329317244)

> @Jay-Karia we generally don't review PRs that are marked as drafts. If this is ready for review, then please fix the CI errors and click "Ready for Review".

### @nzakas — 1 reactions  
`👍 1`  ·  [link](https://github.com/eslint/eslint/pull/18784#issuecomment-2346644777)

> We could always split that example into two examples to make it easier to deal with.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
