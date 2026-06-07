# diesel-rs/diesel #4169 — Added custom array example with documentation.

**[View PR on GitHub](https://github.com/diesel-rs/diesel/pull/4169)**

| | |
|---|---|
| **Author** | @marvin-hansen |
| **Status** | Merged (August 30, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @weiznich
> Thanks for working on this. This is already a really great starting point. I left a bunch of comments on various things...If that example is merged I will try to convert it into a guide on the web page.

### @weiznich
> I want to take a closer look at your suggestion to encapsulate tests into a transaction...you drop the connection itself at the end of the test. This will also drop any uncommited changes for that connection.

### @marvin-hansen
> Just one question: Does the test transaction aborts automatically when it goes out of scope? I did not find any abort or rollback method, but somehow all tests run flawlessly.

### @weiznich
> The problem there was that you likely had already applied the migrations manually...postgres do not allow to modify the schema from more than one connection at once.

### @marvin-hansen
> it might be an option to open an issue with a call for contribution...This would be a great first PR for new contributors.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
