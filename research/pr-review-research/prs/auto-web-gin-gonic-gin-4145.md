# gin-gonic/gin #4145 — feat(render): add bson protocol

**[View PR on GitHub](https://github.com/gin-gonic/gin/pull/4145)**

| | |
|---|---|
| **Author** | @laurentcau |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @appleboy
> // Copyright 2025 Gin Core Team. All rights reserved.

### @appleboy
> The latest version is: v1.17.4

### @appleboy
> go mod tidy

### @appleboy
> Testing fails.

### @Copilot
> Consider using b.Bind(req, &obj) (or BSON.Bind(req, &obj)) to properly test error handling

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
