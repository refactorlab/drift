# uber-go/zap #1501 — Prevent zap.Object from panicing on nils

**[View PR on GitHub](https://github.com/uber-go/zap/pull/1501)**

| | |
|---|---|
| **Author** | @alshopov |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @JacobOaks
> Since this only uses `nilField` for nil interfaces (i.e., when there isn't an actual `MarshalLogObject` method to call) I think this makes sense, but I'd like to wait for a second pair of eyes as well.

### @prashantv
> Just a heads up that this only helps when passing in an interface type with a nil type + value, but not in the case of a struct pointer that's nil. I think the latter is likely more common than passing a nil interface.

### @prashantv
> The solution used for stringer will also help here, but I wanted to call out that the solution here helps in limited cases, and there's other `nil` value cases for which #1500 is not solved.

### @alshopov
> I get your point but these are different problems and need different solutions. What I solved is the case of a missing value in the interface.

### @alshopov
> When the encoder tries to invoke the method it results in a nil dereference. I can try to implement something similar. That would also cover the badly implemented `ObjectMarshaler` case.

### @tchung1118
> Just make sure to rebase before merging to re-run the lint step in CI. Thank you for the contribution!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
