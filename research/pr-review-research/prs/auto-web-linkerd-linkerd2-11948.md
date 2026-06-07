# linkerd/linkerd2 #11948 — Add an endpoints reconciler component for external workloads

**[View PR on GitHub](https://github.com/linkerd/linkerd2/pull/11948)**

| | |
|---|---|
| **Author** | @mateiidavid |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @zaharidichev
> This here makes me a bit nervous. Could we end up in a situation where we have captured and hence deleted slices that are not managed by this controller? We need to think through testing this

### @adleong
> I'm really struggling to review this because going through it side-by-side with the upstream implementation... it would make it a lot easier to see exactly where we do and don't differ from the upstream.

### @zaharidichev
> I managed to get the controller into in invalid state while doing some functional testing... That obviously looks invalid... My advice is to try and turn that into a test a go from there.

### @zaharidichev
> seems to me that a lot of the problems stem from the complicated state management of the endpoints tracker. Would it be useful to leave this bit out and have it as a follow-up PR?

### @adleong
> upstream does a resource version check here and bails out early if there's no resource version change. Does that make sense for us?

### @zaharidichev
> This was resulting in a panic whenever these callbacks fire: panic: interface conversion: interface {} is sets.Empty, not string

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
