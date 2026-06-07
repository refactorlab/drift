# vitest-dev/vitest #7509 — feat: support rolldown-vite

**[View PR on GitHub](https://github.com/vitest-dev/vitest/pull/7509)**

| | |
|---|---|
| **Author** | @sheremet-va |
| **Status** | Merged (June 4, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @hi-ogawa
> These two are oxc transform issues and they are tracked in oxc-project/oxc#9168 and oxc-project/oxc#9129

### @sapphi-red
> I think the value needs to be a resolved path instead of a unresolved specifier here... It's confusing that `resolve.alias` of rolldown works differently from vite or plugin-alias's `resolve.alias`

### @sapphi-red
> Probably this is because of unocss plugin not working unocss/unocss#4403

### @AriPerkkio
> We have couple of places where we use `parseAst` and `parseAstAsync` from Vite. Are those now using `oxc-parser` or the SWC parser via rollup?

### @hi-ogawa
> Source map for global setup is not supported due to Vitest side #7101. The current assertion works because transform output miraculously matched original source

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
