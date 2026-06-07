# TanStack/router #1907 — fix(router): context issues

**[View PR on GitHub](https://github.com/TanStack/router/pull/1907)**

| | |
|---|---|
| **Author** | @tannerlinsley |
| **Status** | Merged (July 16, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @schiller-manuel
> since we are awaiting this, shouldn't `this.startViewTransition` then return a promise?

### @tannerlinsley
> A change to use `getMatch()` and `updateMatch` exclusively, instead of reading and writing to a mix of local and state variables. This has already gotten rid of a few areas where we were definitely reading from stale data

### @tannerlinsley
> Tracking and deduping promises for beforeLoad. This is a very important piece to the fix, since prior to this, we were skipping the before load stage if it was in progress

### @SeanCassiere
> route components are rerendered multiple times when hovering links...when hovering over links the router is rerendering pretty much all Outlet components

### @tannerlinsley
> It should be rerendering any components subscribed to state parts that actually change...we were returning a slice in `<InnerMatch>` that was constantly changing identities

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
