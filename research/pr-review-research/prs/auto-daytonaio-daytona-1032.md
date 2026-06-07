# daytonaio/daytona #1032 — feat: multi-profile support for git providers(#777)

**[View PR on GitHub](https://github.com/daytonaio/daytona/pull/1032)**

| | |
|---|---|
| **Author** | @devdairy699 |
| **Status** | ✅ merged |
| **Opened** | 2024-08-31 |
| **Repo importance** | ★72,501 · 5,619 forks · score 99,977 |
| **Diff** | +1066 / −341 across 49 files |
| **Engagement** | 85 conversation · 121 inline review comments |

## Top review comments (ranked by reactions)

### @idagelic — 2 reactions  
`❤️ 1 · 🎉 1`  ·  [link](https://github.com/daytonaio/daytona/pull/1032#issuecomment-2373338350)

> @the-johnwick Yes, I will review this today

### @Tpuljak — 2 reactions  
`👍 2`  ·  [link](https://github.com/daytonaio/daytona/pull/1032#issuecomment-2373823551)

> @the-johnwick you received way too many reviews for this PR and every time we review, you seem to rush to push the next change to rush us into reviewing.
> 
> As we already said, submitting untested code is not acceptable. Make sure to test **everything** that your PR addresses. Us testing your code for you is not acceptable.
> 
> Go over everything in this PR again and request a new review once you're sure that everything works.

### @Tpuljak — 1 reactions  
`👍 1`  ·  [link](https://github.com/daytonaio/daytona/pull/1032#issuecomment-2324702418)

> > @Tpuljak Please check https://github.com/user-attachments/assets/45a09f06-af6d-4353-9c77-d0975e55a2de
> 
> Thanks for the video. I noticed that you're running this on windows. That's the issue. Please run with `GOOS=linux` set. The issue is that we exclude some files from the windows build so they're not generated in the docs in your case.

### @Tpuljak — 1 reactions  
`👍 1`  ·  [link](https://github.com/daytonaio/daytona/pull/1032#issuecomment-2330753358)

> > @Tpuljak Thank you for the review. Could you please share a screenshot of the error so I can better understand what happened? The expected behavior is that it should work perfectly across all branches since the changes I made are branch-independent. Additionally, I believe we don't have separate Git configurations for different branches from the same repository.
> 
> To reproduce:
> 1. `dtn purge`
> 2. Switch to the main branch
> 3. Start the server
> 4. Add a git provider with `dtn gp add`
> 5. Stop the server
> 6. Switch to your branch
> 7. `dtn gp ls`
> 
> I can't screenshot because the error just includes the entire list of Git providers I added which is confidential.

### @Tpuljak — 1 reactions  
`😄 1`  ·  [link](https://github.com/daytonaio/daytona/pull/1032#issuecomment-2331045711)

> > @Tpuljak I guess you must have git provider added already which has these fields token_identity, token_scope & token_scope_type empty that is why this is happening. you have to remove all the git providers and then readd them. to make it work perfectly. i just added it in commit message
> 
> That's what I've been saying 😄

### @idagelic — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/daytonaio/daytona/pull/1032#issuecomment-2333537256)

> Okay, sounds good. Thank you for your effort!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
