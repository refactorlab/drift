# ent/ent #4398 — schema/field: validate rune length with `MinRuneLen` / `MaxRuneLen`

**[View PR on GitHub](https://github.com/ent/ent/pull/4398)**

| | |
|---|---|
| **Author** | @liangminhua |
| **Status** | Merged (June 20, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @a8m
> we can't accept this change, as it will introduce a breaking-change

(Suggested using a custom validator pattern instead, with example code.)

### @a8m
> just add a small unit-test for it, and one of us will merge this.

### @giautm
> I think it's okay to have this in standard functions, it make life more easy.

### @masseelch
> I agree with Giau

(Supporting giautm's position on adding the new validators to the standard library.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
