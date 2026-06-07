# spring-projects/spring-framework #36641 — Avoid redundant URI object creation in WebClientUtils

**[View PR on GitHub](https://github.com/spring-projects/spring-framework/pull/36641)**

| | |
|---|---|
| **Author** | @MintBee |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @bclozel
> Could we consider adding `httpMethod.name()` and the `" "` at the beginning to the StringBuilder directly? Using a String builder to then perform two concatenations is a bit wasteful.

### @bclozel
> Can you update the implementation to check for the presence of raw user info?

### @bclozel
> Yes please, let's remove the user info, query and fragment if any of them are present.

### @bclozel
> Could explain why the path needs decoding? I think using the raw path would be consistent with URI#toString().

### @bclozel
> Yes please, let's use the encoded form. It will be consistent with the URI toString and will avoid log injection / log forging vulnerabilities.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
