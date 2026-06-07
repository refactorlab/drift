# go-gitea/gitea #36173 — feat: Add configurable permissions for Actions automatic tokens

**[View PR on GitHub](https://github.com/go-gitea/gitea/pull/36173)**

| | |
|---|---|
| **Author** | @Excellencedev |
| **Status** | ✅ merged |
| **Opened** | 2025-12-17 |
| **Repo importance** | ★56,132 · 6,774 forks · score 88,227 |
| **Diff** | +2194 / −290 across 57 files |
| **Engagement** | 235 conversation · 206 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @Zettat123 — 4 reactions  
`👍 2 · 👀 2`  ·  [link](https://github.com/go-gitea/gitea/pull/36173#issuecomment-3750484047)

> > I do another review later as my time allows.
> > 
> > AW While I looked at package access, I wanted that a repo can create a org/user container without explicit repo permission via private visibility if the resource does not exist yet (I am frequently using such a feature on GitHub). However I agree the linked issue does not contains such requirement anywhere.
> 
> I agree. I did some testing on GitHub, and when a brand-new, non-existent package is created via GitHub Actions, it is successfully created and automatically linked to the repository running the workflow. I believe Gitea could support this feature as well.

### @silverwind — 3 reactions  
`👍 3`  ·  [link](https://github.com/go-gitea/gitea/pull/36173#issuecomment-3667987277)

> Imho, the only sensible thing we can do is race these 2 PRs.

### @Excellencedev — 2 reactions  
`👍 2`  ·  [link](https://github.com/go-gitea/gitea/pull/36173#issuecomment-3718395628)

> I've refactored the parser to implement priority: contents is applied first, then granular scopes like `code` and `releases` override it. This ensures specific keywords always take precedence over the broad contents keyword, regardless of their order in the YAML. I added  unit test to verify this
> Fix is in https://github.com/go-gitea/gitea/pull/36173/commits/43931dc5a1369d99b75fa84da97b15018bef9b63

### @ChristopherHX — 2 reactions  
`👍 2`  ·  [link](https://github.com/go-gitea/gitea/pull/36173#issuecomment-3765122975)

> Thanks, I think the UI is better structured now
> 
> - I would remove the red star from maximum permission now (this does not look like a required form field)
> - Customize maximum permission is now always enabled after reload / disabling it does not save
>   - Org page has a popup that I have unsaved changes if I do this and then press the save button
>   - Repo page has no popup
>   - The whole maximum permission table is now defect and do not save
>     - I wanted to try if I can see org permission restricting the repo override, but couldn't test this
>     - Usually an org admin might want to prohibit a repo admin (who is no an org admin) from granting more access than the org allows
>       - Both use cases could be useful, e.g. allow more access for selected repos / deny more access
> - stale translation entries needs to be fixed

### @wxiaoguang — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/go-gitea/gitea/pull/36173#issuecomment-3665138511)

> Thank you for asking me to review, but I don't use Actions. You can invite the maintainers from the original issue to review.

### @silverwind — 1 reactions  
`👍 1`  ·  [link](https://github.com/go-gitea/gitea/pull/36173#issuecomment-3666354912)

> I review mostly frontend stuff and am not much of an actions user myself, so please be patient until someone finds time to review it properly.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
