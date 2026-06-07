# urfave/cli #2043 — while print flag , the placeholder if need but not set.

**[View PR on GitHub](https://github.com/urfave/cli/pull/2043)**

| | |
|---|---|
| **Author** | @jokemanfire |
| **Status** | Merged (Feb 8, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @abitrolly
> This whole section is questionable...The `unquoteUsage()` function parses flag value type from the usage (!) string. I am +1 on dropping this workaround if this PR works.

### @Skeeve
> I think the '[]' is of no additional value and should be omitted. Brackets have a well known meaning in usage texts. They are confusing here.

### @avorima
> If reflect.Type.Name() is not enough for get all base type, I will try to use other method

### @avorima
> If the interface method were `Type() string` it would allow inter-op with pflag's Value interface.

### @dearchap
> Approved changes after revisions were made, indicating the refinements addressed maintainer concerns.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
