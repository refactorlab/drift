# vitessio/vitess #15992 — add support for vtgate traffic mirroring (queryserving)

**[View PR on GitHub](https://github.com/vitessio/vitess/pull/15992)**

| | |
|---|---|
| **Author** | @maxenglander |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @harshit-gangal
> we can specifically check for RealTable type here and check on the mirror rule.

### @harshit-gangal
> nit: better to check the slice length before using indices.

### @harshit-gangal
> nit: for all the panic send along and error inside, like `panic(vterrors.VT13001(...))`

### @harshit-gangal
> adding a test with mirror percentage 0, should be a good one to check plan without mirror operator.

### @harshit-gangal
> having variable percentage would be a good to have, also to verify which percentage the plan selects

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
