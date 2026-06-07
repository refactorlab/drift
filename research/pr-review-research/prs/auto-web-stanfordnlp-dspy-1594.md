# stanfordnlp/dspy #1594 — Refactor finetuning implementation to be 2.5 compatible

**[View PR on GitHub](https://github.com/stanfordnlp/dspy/pull/1594)**

| | |
|---|---|
| **Author** | @isaacbmiller |
| **Status** | Merged (Oct 18, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @okhat
> Besides the things discussed on Slack, this is good to merge except for `lm.py` which I think @dilarasoylu is handling.

### @chenmoneygithub
> Nice work! Agreed with @okhat, the PR can use some refactoring to have the finetuning code in a standalone mode.

### @chenmoneygithub (regarding the `assert_structural_equivalency_for_predictors` function)
> Yes this type hint is a bit confusing, we can omit the type hints here.

### @chenmoneygithub (requested changes review)
> Thanks for the update! Most comments are on nits.

### @okhat
> Incredible work on this @dilarasoylu & @isaacbmiller !!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
