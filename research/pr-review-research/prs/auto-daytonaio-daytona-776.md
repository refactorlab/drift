# daytonaio/daytona #776 — feat: add pagination for all GET apis' of git providers

**[View PR on GitHub](https://github.com/daytonaio/daytona/pull/776)**

| | |
|---|---|
| **Author** | @abhishek818 |
| **Status** | ✅ merged |
| **Opened** | 2024-07-15 |
| **Repo importance** | ★72,501 · 5,619 forks · score 99,977 |
| **Diff** | +995 / −282 across 36 files |
| **Engagement** | 52 conversation · 66 inline review comments |

## Top review comments (ranked by reactions)

### @abhishek818 — 2 reactions  
`❤️ 1 · 😄 1`  ·  [link](https://github.com/daytonaio/daytona/pull/776#issuecomment-2393812172)

> > @abhishek818 this seems to work great! Nice work.
> > 
> > That being said, I suggest we change the approach a little bit.
> > 
> > Instead of having `Previous Page` and `Next Page`, I suggest we have `Load more` that would load the next batch of items. These items would also be stored in memory and simply pushed to the existing list.
> > 
> > This will achieve 2 things:
> > 
> >     1. Make it easier to navigate back - the user would not have to fetch items from the API when going backwards
> > 
> >     2. It would improve the frontend search functionality (when the user presses `/`) - it would allow the user to query more results once more results are fetched.
> > 
> > 
> > From what I can see, not much of the code would have to change. You would need to remove the Previous page inputs and push new items to the existing list.
> > 
> > Let me know if you have any questions.
> > 
> > P.S. Putting this in Draft until it's addressed.
> 
> oh, I felt in love with my perfect code, hurts to remove certain parts. lol.. doing it.

### @abhishek818 — 1 reactions  
`👍 1`  ·  [link](https://github.com/daytonaio/daytona/pull/776#issuecomment-2231293829)

> update: if not urgently needed to be merged, will come back to this after a couple of days.

### @Tpuljak — 1 reactions  
`🚀 1`  ·  [link](https://github.com/daytonaio/daytona/pull/776#issuecomment-2247831798)

> > unable to correct swagger related linting errors (docs error is gone, but some linting issues for code related files are persisted)
> 
> Have you tried running `go fmt ./...` to format the entire repo. I think that might be the problem

### @abhishek818 — 1 reactions  
`👍 1`  ·  [link](https://github.com/daytonaio/daytona/pull/776#issuecomment-2351991330)

> wait ! i got some idea, but also busy with other work, will come back. Perhaps catching the currentPage of items (if changed) from the TUI model just the way choice is currently catched from channel, we will further call the pagination api. I had  overthink everything earlier.

### @Tpuljak — 1 reactions  
`👍 1`  ·  [link](https://github.com/daytonaio/daytona/pull/776#issuecomment-2382285936)

> @abhishek818 a few unit tests are failing (https://github.com/daytonaio/daytona/actions/runs/11094177048?pr=776). Please address that before we review.

### @Tpuljak — 1 reactions  
`👍 1`  ·  [link](https://github.com/daytonaio/daytona/pull/776#issuecomment-2394042775)

> Ah, okay. Let's remove that label completely then.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
