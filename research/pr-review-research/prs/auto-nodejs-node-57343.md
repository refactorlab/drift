# nodejs/node #57343 — build, doc: use new api doc tooling

**[View PR on GitHub](https://github.com/nodejs/node/pull/57343)**

| | |
|---|---|
| **Author** | @flakey5 |
| **Status** | ✅ merged |
| **Opened** | 2025-03-06 |
| **Repo** | curated review-culture seed |
| **Diff** | +4552 / −5579 across 58 files |
| **Engagement** | 216 conversation · 126 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @trivikr — 4 reactions  
`👀 4`  ·  [link](https://github.com/nodejs/node/pull/57343#issuecomment-2849292273)

> Is there still time to get the new API docs tooling before 24.0.0 release on Tue, May 6th?

### @flakey5 — 2 reactions  
`👍 2`  ·  [link](https://github.com/nodejs/node/pull/57343#issuecomment-2722490721)

> I think they are related, it can't find a node binary when running `npm install` in `tools/doc`. Will take a look in a bit

### @flakey5 — 2 reactions  
`👍 2`  ·  [link](https://github.com/nodejs/node/pull/57343#issuecomment-2781164406)

> > The actual issue being that if we were to merge this, https://nodejs.org/api/index.html would be 404.
> 
> That shouldn't be the case? The `index.html` file is still generated w/ `make doc-only` and `make doc`

### @aduh95 — 2 reactions  
`👍 2`  ·  [link](https://github.com/nodejs/node/pull/57343#issuecomment-2781338862)

> > > The actual issue being that if we were to merge this, https://nodejs.org/api/index.html would be 404.
> > 
> > That shouldn't be the case? The `index.html` file is still generated w/ `make doc-only` and `make doc`
> 
> I can confirm that `out/doc/api/index.html` is correctly generated now :+1:

### @ovflowd — 2 reactions  
`👀 2`  ·  [link](https://github.com/nodejs/node/pull/57343#issuecomment-2797917545)

> > Here's what we currently have: https://github.com/nodejs/remark-preset-lint-node/blob/79792fc74f48f467b8c649672c08003a55bba4ed/remark-lint-nodejs-yaml-comments.js#L55-L60 It looks like it's incorrectly ignoring v0.11.x as well, we should look into that
> 
> We just fixed it upstream. @flakey5 can you update the version used here? And rebase the PR so that @aduh95 can remove the block and we can finally merge this? :pray:

### @ovflowd — 2 reactions  
`😕 2`  ·  [link](https://github.com/nodejs/node/pull/57343#issuecomment-2817325825)

> Hey @avivkeller, I noticed that you pushed a commit to @flakey5's pull request. It’s generally not common practice for contributors to push changes to someone else's pull request on the nodejs/node repository without explicit permission from the author. Please keep that in mind! Additionally, since you’re not a core collaborator, you shouldn’t perform actions that are reserved for core collaborators, which I believe this would qualify as.
> 
> If I’m wrong or if anyone has a different perspective, please feel free to correct me.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
