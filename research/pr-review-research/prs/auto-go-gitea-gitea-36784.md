# go-gitea/gitea #36784 — Allow multiple projects per issue and pull requests

**[View PR on GitHub](https://github.com/go-gitea/gitea/pull/36784)**

| | |
|---|---|
| **Author** | @icyavocado |
| **Status** | ✅ merged |
| **Opened** | 2026-02-28 |
| **Repo importance** | ★56,132 · 6,774 forks · score 88,227 |
| **Diff** | +1590 / −423 across 58 files |
| **Engagement** | 24 conversation · 119 inline review comments |

## Top review comments (ranked by reactions)

### @okdas — 2 reactions  
`👍 2`  ·  [link](https://github.com/go-gitea/gitea/pull/36784#issuecomment-4186393835)

> Just wanted to say we're following this with interest. We're evaluating a move from Forgejo to Gitea and multi-project support plus a projects API would be a deciding factor.
> 
> The work here looks solid. Happy to help test when it's ready.

### @bircni — 2 reactions  
`👍 1 · 🎉 1`  ·  [link](https://github.com/go-gitea/gitea/pull/36784#issuecomment-4186858406)

> @icyavocado updates? please lets try to move this into 1.26

### @silverwind — 2 reactions  
`🎉 2`  ·  [link](https://github.com/go-gitea/gitea/pull/36784#issuecomment-4274438246)

> We'll merge https://github.com/go-gitea/gitea/pull/37037 soon then this can be continued. It should be pretty trivial with the preparations done in that PR.

### @icyavocado — 2 reactions  
`👍 2`  ·  [link](https://github.com/go-gitea/gitea/pull/36784#issuecomment-4314806680)

> > you got some conflicts
> 
> Thank you! Conflict fixed, e2e tests needed to be updated. Sorry for the force pushed.

### @silverwind — 1 reactions  
`👀 1`  ·  [link](https://github.com/go-gitea/gitea/pull/36784#issuecomment-4036902254)

> *This comment was written by Claude.*
> 
> Some issues I found during review:
> 
> 1. **`DiffSlice` can produce duplicate entries.** If `newSlice` contains `[4, 4, 5]` and `oldSlice` is `[1]`, `added` returns `[4, 4, 5]` because it iterates the input slice but only checks membership in the other set. In `IssueAssignOrRemoveProject`, this could insert duplicate `project_issue` rows. The output should be deduplicated.
> 
> 2. **`newColumnID` shared across all added projects is architecturally wrong.** In `IssueAssignOrRemoveProject`, a single `newColumnID` is used for all projects being added. A column belongs to a specific project — using project A's column for project B would create invalid data. Current callers all pass `0` (defaulting to each project's default column) so this isn't triggered today, but the function signature invites misuse.
> 
> 3. **"No project" indexer test case removed without replacement.** The old `"no ProjectID"` test (searching for issues with no project assigned) was deleted. This removes test coverage for an important filter.
> 
> 4. **`SearchIssues` returns HTTP 500 for bad user input.** Malformed `projects` query parameter triggers `ctx.HTTPError(http.StatusInternalServerError, ...)` — should be 400 Bad Request.
> 
> 5. **`SelectedProjectID` changed from `int64` to comma-separated `string`.** This is fragile — an `[]int64` field with template-level serialization would be type-safe.
> 
> 6. **Possible double-filtering for `ProjectColumnID`.** The new `applyProjectCondition` handles `ProjectColumnID` inline for single-project and multi-project cases, but the standalone `app … *[truncated]*

### @silverwind — 1 reactions  
`👍 1`  ·  [link](https://github.com/go-gitea/gitea/pull/36784#issuecomment-4036908615)

> > E2E test video: [video.webm](https://github.com/user-attachments/assets/4606c498-5ea0-42ec-9271-1270a8a3a9d0)
> 
> If you like, you can add a actual playwright e2e test, just ensure that it's absolutely stable and not flaky please.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
