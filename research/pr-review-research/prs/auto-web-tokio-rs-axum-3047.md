# tokio-rs/axum #3047 — Add an encapsulated file stream in axum-extra to make it more convenient

**[View PR on GitHub](https://github.com/tokio-rs/axum/pull/3047)**

| | |
|---|---|
| **Author** | @YanHeDoki |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ttys3
> the usage of this PR feature seems rather limited...it does not handle HTTP range requests...it limited the response header. it fixed to `application/octet-stream` and `attachment; filename=xxx`

### @ttys3
> I suggest put this as an external crate, if it is limited to `application/octet-stream`

### @jplatte
> Wait, why would we not add stuff like range header support to this and have it in axum-extra then? It's a very common feature request.

### @jplatte
> I still think it makes sense to have this as a feature. It's independent of `Attachment` in its purpose, and can be combined with it if wanted.

### @jplatte
> Thank you! I think there's still some improvements to be done, but that can be done separately.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
