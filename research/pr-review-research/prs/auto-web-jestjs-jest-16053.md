# jestjs/jest #16053 — feat(jest-mock): add `mock.whenCalledWith(...)`

**[View PR on GitHub](https://github.com/jestjs/jest/pull/16053)**

| | |
|---|---|
| **Author** | @timkindberg |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @SimenB
> The `equals`-based same-matchers merge seems broken for duplicate asymmetric matchers...Referential equality for the merge check would probably be more correct, or drop the merge entirely

### @SimenB
> There's also seemingly a footgun when mixing `mockImplementation` with `whenCalledWith`...The third call reinstalls the dispatcher, wiping the `'x'` registration.

### @SimenB
> `getMockImplementation()` now returns the internal dispatcher function once `whenCalledWith` has been called, rather than the user-visible impl.

### @jeysal
> Basically shouldn't we fully integrate fallback implementation and branches, rather than 'switching back and forth' between modes?

### @jeysal
> I don't think we should be order dependent...branches override; otherwise the base implementation wins, regardless of registration order.

### @SimenB
> The overlapping-matchers precedence is complex but probably worth it...just make sure the precedence table in the docs is easy to find

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
