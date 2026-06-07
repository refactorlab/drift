# microsoft/pyright #10055 — Implement support for pull diagnostics in Pyright

**[View PR on GitHub](https://github.com/microsoft/pyright/pull/10055)**

| | |
|---|---|
| **Author** | @rchiodo |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @erictraut
> Is there any chance this will break the language server when it's running with clients other than VS Code? Does it fall back on push diagnostics if the client doesn't support the pull mechanism?

### @rchiodo
> Yes, the client has to have these settings in the initialization params... If those aren't set, push diagnostics will still be used.

### @erictraut
> LGTM. It might be worth doing a quick manual test of the CLI with watch mode (--watch). We don't have any tests for this, and it could potentially be affected by some of the code paths you touched in this PR

### @erictraut
> @rchiodo, I just merged this PR by mistake. I thought I was merging a different PR that I was working on. If this PR wasn't ready to merge, I can back it out.

### @erictraut
> @rchiodo, with this change merged, I'm now seeing failures in local tests... Unhandled method test/getOpenFiles

### @rchiodo
> Did you build the test server? `npm run test` is supposed to rebuild it. That first error would be exactly that.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
