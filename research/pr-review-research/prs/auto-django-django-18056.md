# django/django #18056 — Fixed #373 -- Added CompositePrimaryKey.

**[View PR on GitHub](https://github.com/django/django/pull/18056)**

| | |
|---|---|
| **Author** | @csirmazbendeguz |
| **Status** | ✅ merged |
| **Opened** | 2024-04-07 |
| **Repo** | curated review-culture seed |
| **Diff** | +3078 / −29 across 43 files |
| **Engagement** | 60 conversation · 392 inline review comments |

## Top review comments (ranked by reactions)

### @davidhalter — 22 reactions  
`❤️ 16 · 🎉 3 · 🚀 3`  ·  [link](https://github.com/django/django/pull/18056#issuecomment-2508783532)

> I have been following this PR and it's incredible that it finally landed. The amount of work and persistence that @csirmazbendeguz put into this is awesome. Thanks also to the reviewers for your patient and encouraging work!
> 
> It is a reassuring feeling, that such big and useful changes can still land within Django, without sacrificing quality.

### @csirmazbendeguz — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/django/django/pull/18056#issuecomment-2458401870)

> Hey everyone!
> 
> We have managed to tackle some issues in separate PRs.
> I cannot find anything else that we can merge separately.
> It's time to review this PR once again.
> It looks like a big one, but there's only _442 lines of code_ changes in `django`, the rest are `docs` and `tests`.
> 
> Any review is appreciated.

### @grjones — 4 reactions  
`👍 1 · ❤️ 2 · 🎉 1`  ·  [link](https://github.com/django/django/pull/18056#issuecomment-2508804781)

> > I have been following this PR and it's incredible that it finally landed. The amount of work and persistence that @csirmazbendeguz put into this is awesome. Thanks also to the reviewers for your patient and encouraging work!
> > 
> > It is a reassuring feeling, that such big and useful changes can still land within Django, without sacrificing quality.
> 
> Ditto. Absolutely amazing work, all.

### @sarahboyce — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/django/django/pull/18056#issuecomment-2485029476)

> @timgraham @smithdc1 I believe your comments have been addressed, thank you for the reviews!
> Please check and let us know if you think there should be further changes or if you're happy :+1:

### @csirmazbendeguz — 1 reactions  
`🚀 1`  ·  [link](https://github.com/django/django/pull/18056#issuecomment-2062903864)

> Thanks for testing and reporting the issue @grjones! Indeed, I forgot to handle this use case. I'll look into it this week.

### @csirmazbendeguz — 1 reactions  
`👍 1`  ·  [link](https://github.com/django/django/pull/18056#issuecomment-2093988072)

> Thank you so much for taking the time to review my changes @LilyFoote !
> I have two questions:
> 
> 1. If `Meta.primary_key` is defined, this PR will automatically add a composite field called `primary_key` to the model. What do you think about this approach? I felt like it was easier to handle the composite primary keys this way as we can run checks against the meta class instead of traversing the model's fields for a composite field.
> 2. I wrote a lot of tests testing the underlying queries made by the ORM. It makes a lot of sense to me, but I haven't seen this type of tests that much in the Django source code - do these tests look okay to you?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
