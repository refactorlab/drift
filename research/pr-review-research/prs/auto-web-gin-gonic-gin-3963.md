# gin-gonic/gin #3963 — refactor(context): refactor `Keys` type to `map[any]any`

**[View PR on GitHub](https://github.com/gin-gonic/gin/pull/3963)**

| | |
|---|---|
| **Author** | @flc1125 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jarrodhroberson
> Why not just make it `comparable`, or just `any`?

### @flc1125
> It can be supported, so why not? Moreover, when the `key` is set to `struct{}`, it saves more memory

### @xiaotushaoxia
> break backwards. looks not good for me. if somebody write code like this, this pr make it build fail

### @dmitry-novozhilov
> gin.Context is an implementation of context.Context. And it is a broken implementation, because keys should be any

### @lukeo3o1
> Caused some type assertion issues in existing wrappers, since the key parameter is no longer strictly a string

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
