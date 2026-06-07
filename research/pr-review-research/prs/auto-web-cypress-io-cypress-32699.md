# cypress-io/cypress #32699 — fix: normalize test body `invocationDetails` from stack traces

**[View PR on GitHub](https://github.com/cypress-io/cypress/pull/32699)**

| | |
|---|---|
| **Author** | @astone123 |
| **Status** | Merged (November 18, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @AtofStryker
> Likely good to reference what `itGrep` is and where it is coming from (same with above)... The other concern I have is that there could be something legitimate in the stack that has `itGrep` in it that we want to capture but are omitting it here.

### @astone123
> I'm pretty sure this function is specifically used to identify where the test was executed from, so this shouldn't affect anything else. If it does, it'll be limited to use of the grep plugin

### @mschile
> (Requested changes during review on November 17, 2025, with multiple specific comments on test logic and stack-trimming implementation details.)

### @mabela416
> I tested it locally and it works

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
