# expressjs/express #5595 — Adopt Node@18 as the minimum supported version

**[View PR on GitHub](https://github.com/expressjs/express/pull/5595)**

| | |
|---|---|
| **Author** | @UlisesGascon |
| **Status** | ✅ merged |
| **Opened** | 2024-04-11 |
| **Repo importance** | ★69,098 · 23,601 forks · score 168,455 |
| **Diff** | +150 / −164 across 4 files |
| **Engagement** | 31 conversation · 3 inline review comments |

## Top review comments (ranked by reactions)

### @UlisesGascon — 1 reactions  
`👍 1`  ·  [link](https://github.com/expressjs/express/pull/5595#issuecomment-2050188883)

> > I had been thinking about this last night after our meeting and I was thinking that we should get all the dependencies working as we expect first and then do this specific change last.
> 
> AFAIK, there is no rush to merge this PR. It can be the last one before we officially release v5. Let's keep it open for a while and see how do we feel about it in few more commits :+1:

### @UlisesGascon — 1 reactions  
`👍 1`  ·  [link](https://github.com/expressjs/express/pull/5595#issuecomment-2095250157)

> @crandmck you are right, the decision was made already (so in terms of documentation we are fine saying Node@18). This PR has moved to draft as we probably will merge it as the last one before releasing Express@5 [ref](https://github.com/expressjs/express/pull/5595#issuecomment-2050188883)

### @RobinTail — 1 reactions  
`👍 1`  ·  [link](https://github.com/expressjs/express/pull/5595#issuecomment-2243914662)

> > we probably will merge it as the last one before releasing Express@5 [ref](https://github.com/expressjs/express/pull/5595#issuecomment-2050188883)
> 
> I recommend to do it now, @UlisesGascon .
> This PR should be treated as a foundation of 5.x, because it enables using modern syntax, latest dependencies and to remove various compatibility crutches in all other PRs.

### @wesleytodd — 1 reactions  
`👍 1`  ·  [link](https://github.com/expressjs/express/pull/5595#issuecomment-2246367143)

> Cool, glad my idea made some sense lol. I just want to *know* when we break it even if it is only the *first* break since that is all around better than *not* knowing 😄 
> 
> EDIT: to clarify a bit on top of what @ctcpip said, the idea I had was that we would be able to tell exactly what commit broke people in this complicated and intertwined web of packages. If we cannot figure out which version broke a specific node version it means we just have a more difficult time tracking it down if necessary. This is not a blocker, but it could be useful in the future. Again, this should not stop us from just landing this change, just context to be aware of. So my earlier statement stands, if this is not a draft anymore and we have the approvals, we should just land it and move forward.

### @wesleytodd — 1 reactions  
`🎉 1`  ·  [link](https://github.com/expressjs/express/pull/5595#issuecomment-2251047953)

> Great addition! We can still tell when CI fails but it does not block! I only made one comment but then yeah I think we should land this!

### @ctcpip — 1 reactions  
`👍 1`  ·  [link](https://github.com/expressjs/express/pull/5595#issuecomment-2251060290)

> the change also unpins the node minor versions, something we previously agreed to...  and I see that is now causing 21 to fail with our favorite query issue.  probably solved with a rebase.  checking


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
