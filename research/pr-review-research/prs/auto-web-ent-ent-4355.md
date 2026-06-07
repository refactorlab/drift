# ent/ent #4355 — entc/gen: change receivers to static one

**[View PR on GitHub](https://github.com/ent/ent/pull/4355)**

| | |
|---|---|
| **Author** | @giautm |
| **Status** | Merged (March 19, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @matdibu
> I think this didn't include sql modifiers it works in v0.14.4 but it breaks in v0.14.5

### @matdibu
> undefined: tq

(Post-merge report: the receiver naming wasn't consistently updated across all code generation paths, producing undefined-variable errors in generated code.)

### @tankbusta
> Problem was `entgo.io/contrib@v0.6.0` didnt have the new logic

### @giautm
> Please try upgrade ent/contrib to latest version, I've the patch on it there: ent/contrib#617

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
