# linkerd/linkerd2 #12195 — Set proxy-injector, tap-injector and jaeger-injector mutating webhook rules scope to Namespaced

**[View PR on GitHub](https://github.com/linkerd/linkerd2/pull/12195)**

| | |
|---|---|
| **Author** | @mdnfiras |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @alpeb
> Great fix, thanks! To fix the tests, please run `go test ./... -update` to recreate the test fixtures 😉

### @alpeb
> ...and also please address the [DCO](https://github.com/linkerd/linkerd2/blob/main/CONTRIBUTING.md#developer-certificate-of-origin)

### @alpeb
> LGTM, thanks [@mdnfiras](https://github.com/mdnfiras) !

> **Note:** This PR's discussion focused primarily on implementation logistics (test-fixture regeneration and DCO compliance) rather than extended design trade-offs. The substantive, web-retrievable comments are those above, all from reviewer @alpeb.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
