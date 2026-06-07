# urfave/cli #2094 — feat!: add more integers and unsigned integers

**[View PR on GitHub](https://github.com/urfave/cli/pull/2094)**

| | |
|---|---|
| **Author** | @somebadcode |
| **Status** | Merged (Apr 19, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @xoxys
> This change is breaking again, right? I'm wondering about how this will be released. Will we see v4 soon?

### @dearchap
> Yes breaking change. Can't help it.

### @somebadcode
> Yes, it's breaking since it changes `Int` from `int64` to `int`...Any package that try to be an alternative should have the same base feature-set.

### @dearchap
> Final request. There are 2 spots not covered by any tests...Basically the String() function of uintValue[T].

### @dearchap
> Can you run `make v3approve` and push your changes. That should fix the failing checks.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
