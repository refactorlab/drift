# reduxjs/redux-toolkit #4738 — RTKQ Infinite Query integration

**[View PR on GitHub](https://github.com/reduxjs/redux-toolkit/pull/4738)**

| | |
|---|---|
| **Author** | @markerikson |
| **Status** | Merged (February 23, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @agusterodin
> If you have the global `refetchOnMountOrArgChange: true` option set on your API, fetching the next page in infinite queries won't work.

### @markerikson
> the new functionality adds 7K min to all RTKQ usages...That said, 5K min seems like a plausibly reasonable cost to pay to add the feature.

### @remus-selea
> I've noticed that upsertQueryData no longer behaves as it used to...it now removes the `data` field entirely for the query.

### @agusterodin
> I have two `initialPageParams` defined (one in hook and another in endpoint definition). Will this cause conflict?

### @markerikson
> you'd have to change the page param type to be `{offset: string, page: number}`, then update the `getNextPageParam` callback.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
