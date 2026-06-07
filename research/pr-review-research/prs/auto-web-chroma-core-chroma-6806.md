# chroma-core/chroma #6806 — [ENH] Add put_stream to chroma-storage for streaming S3 uploads

**[View PR on GitHub](https://github.com/chroma-core/chroma/pull/6806)**

| | |
|---|---|
| **Author** | @philipithomas |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @rescrv
> Did you give thought to how/whether to implement this? Will it forever nerf?

### @philipithomas
> this needs a design decision. my understanding is that admission control is a rate limiter for s3 writes, and for streaming - there are some nuances to how that's implemented.

### @rescrv
> One scenario per test, with a descriptive test name, please. I detest table-driven tests when unrolled.

### @rescrv
> The idiomatic rust solution to copying code into error handling paths is to make an `_inner` or `_wrapped` function and call it like so...

### @philipithomas
> we limit to 200 mib on sync frontend so we should not hit this.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
