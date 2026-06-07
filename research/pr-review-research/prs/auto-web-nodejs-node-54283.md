# nodejs/node #54283 — module: add --experimental-transform-types flag

**[View PR on GitHub](https://github.com/nodejs/node/pull/54283)**

| | |
|---|---|
| **Author** | @marco-ippolito |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mcollina
> I think `--experimental-enable-type-transform` should imply `--enable-source-maps`

### @legendecas
> Can we also add a test case that `--experimental-enable-transformation` doesn't eliminate unused imports?

### @jakebailey
> No, this is just isolatedModules. Node.js is not shipping a type checker that can perform that kind of analysis.

### @statianzo
> Has there been discussion around writing out the result of typescript transformation? It would allow package creators to publish TS → JS consistent with the transformations node is doing internally.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
