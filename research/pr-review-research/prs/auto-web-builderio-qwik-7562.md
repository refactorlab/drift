# BuilderIO/qwik #7562 — Support rewrite request (Similarly to redirect)

**[View PR on GitHub](https://github.com/BuilderIO/qwik/pull/7562)**

| | |
|---|---|
| **Author** | @omerman |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @wmertens
> when you get a rewrite request, you need to restart processing, so you should basically call the handler again, skipping any initialization tasks

### @wmertens
> so the http request object itself cannot be recreated, and should be retained. Ideally the whole RequestEvent object is retained, the less work the better.

### @wmertens
> After the rewrite, the route modules have to be regenerated and the request handling has to happen again.

### @wmertens
> Also, very important to add e2e tests. See /e2e

### @omerman
> Sorry to bug you yet again, I'm reverting this PR back to a draft because I tried to link it to my work in progress of converting a full website to qwik, and I get an issue with routeLoaders.

### @wmertens
> I'm guessing that executing the routeloaders got skipped somewhere. I'm not quite sure if we can keep the results of the previous run but I'm inclined to let that happen.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
