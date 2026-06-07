# typeorm/typeorm #11798 — feat(mysql): update query types to include named parameters

**[View PR on GitHub](https://github.com/typeorm/typeorm/pull/11798)**

| | |
|---|---|
| **Author** | @kranners |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @pkuczynski
> Looks good, however this seems to work only for mysql2? Can you update the jsdoc and mention this? Some tests would be also very useful...

### @alumni
> I hope I'm not mixing things up, but I think we had some discussion and we weren't sure if we should accept the PR since it is supported on only one driver.

### @kranners
> I think there is a bit of confusion around this already, and there is also already built-in functionality for escaping a query with named parameters.

### @alumni
> BTW, there's an sql template literal that's already implemented. Wouldn't that make queries easier to read?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
