# istio/istio #55419 — krt: add nested join collection

**[View PR on GitHub](https://github.com/istio/istio/pull/55419)**

| | |
|---|---|
| **Author** | @keithmattix |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ilrudie
> Would you be able to describe the intended use case for this to bring context?

### @howardjohn
> Delete+Add is pretty unfortunate since it means we are dropping everything for a short period.

### @howardjohn
> nit: why not just store the `HandlerRegistration` then we don't need 2 separate lists

### @stevenctl
> does the handler we pass here need to be wrapped with something that holds the lock?...any concern about handling events while a collection is being added or cleaned up?

### @stevenctl
> how hard would it be to add a 'stress' test that adds/removes collections frequently at the same time as triggering events

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
