# rtk-ai/rtk #312 — feat(gradlew): Gradle support for Android/Kotlin developers

**[View PR on GitHub](https://github.com/rtk-ai/rtk/pull/312)**

| | |
|---|---|
| **Author** | @kherembourg |
| **Status** | ✅ merged |
| **Opened** | 2026-03-03 |
| **Repo importance** | ★59,190 · 3,643 forks · score 78,761 |
| **Diff** | +1678 / −0 across 12 files |
| **Engagement** | 27 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @est7 — 3 reactions  
`👍 3`  ·  [link](https://github.com/rtk-ai/rtk/pull/312#issuecomment-4350822018)

> Could we merge this soon? Looking forward to it.

### @kherembourg — 2 reactions  
`👍 2`  ·  [link](https://github.com/rtk-ai/rtk/pull/312#issuecomment-4315012504)

> Hi @aeppling 
> 
> Thanks a lot for the feedback! No worries about the delay, I completely understand the challenges of maintaining a successful open source project.
> 
> Everything should be addressed:
> 1. `Cargo.lock` removed from the commit via interactive rebase, no longer touched anywhere in the branch.
> 2. `rules.rs` conflict resolved.
> 3. Lint filter now preserves code context. filter_lint keeps up to 3 non-empty lines after any Android lint violation (snippet, caret, explanation) and stops at the blank-line separator.
> 4. Build filter now captures warnings.
> 5. Out-of-scope Ruby changes reverted.

### @aeppling — 2 reactions  
`❤️ 1 · 🎉 1`  ·  [link](https://github.com/rtk-ai/rtk/pull/312#issuecomment-4390491984)

> LGTM :) 
> 
> Will be released in 0.40.0 , by the end of the week i think!
> Thanks for contributing to RTK by extending its coverage @kherembourg

### @pszymkowiak — 1 reactions  
`👍 1`  ·  [link](https://github.com/rtk-ai/rtk/pull/312#issuecomment-4133413409)

> Hi! Two things needed before we can review:
> 
> 1. **Retarget to `develop`** — this PR targets `master`, but all PRs should target `develop`. You can change the base branch in the PR settings (right sidebar).
> 2. **Sign the CLA** — if not already done, please sign at https://cla-assistant.io/rtk-ai/rtk
> 
> Thanks!

### @kherembourg — 1 reactions  
`🎉 1`  ·  [link](https://github.com/rtk-ai/rtk/pull/312#issuecomment-4163926292)

> Thanks @pszymkowiak @aeppling 
> Everything is up to date with your recommendations and I have signed the CLA.
> Ready for review :)

### @kherembourg — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/rtk-ai/rtk/pull/312#issuecomment-4377857625)

> Hey @aeppling 
> 
> I have made all the changes, it should be coherent with the refacto on develop now and all changes are related to this PR purpose.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
