# honojs/hono #4291 — feat(serve-static): use `join` to correct path resolution

**[View PR on GitHub](https://github.com/honojs/hono/pull/4291)**

| | |
|---|---|
| **Author** | @yusukebe |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @yusukebe
> We can use [@std/path](https://jsr.io/@std/path/doc), but it's better to use `node:path` because it's built into Deno.

### @usualoma
> As it stands, the frequency of defaultJoin usage is very low, so I think it's important to keep the code size small, so I think it would be better to do the following.

(Followed by a code-refactoring suggestion to simplify `defaultJoin`.)

### @yusukebe
> In the previous implementation, if the file was not found, it checked whether `index.html` existed. This PR, that process has been removed. Since serve static for Cloudflare Workers is deprecated and not planned to be used, this change is acceptable.

### @usualoma
> (Comment on code style/implementation details in `path.ts`; the specific text was marked "Outdated" and not fully visible on the rendered conversation page.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
