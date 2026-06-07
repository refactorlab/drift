# electron/electron #50043 — feat: capture JS stack trace on renderer OOM

**[View PR on GitHub](https://github.com/electron/electron/pull/50043)**

| | |
|---|---|
| **Author** | @alexkozy |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @deepak1556
> I like that we are waiting for the next possible execution point to capture the stack trace but I am unsure if the captured stack is useful for all the different cases...

### @deepak1556
> Should there be check for available heap size [for] CurrentStackTrace and formatting

### @deepak1556
> Does this bumping work when we are at the cage limit of 4GB

### @deepak1556
> V8 seems to capture heap stats as crash keys but it gets missed today due to the OOM callback override... wonder if we can include that to get some more heuristics in the dump.

### @nikwen
> Looks like there is still a small linter error

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
