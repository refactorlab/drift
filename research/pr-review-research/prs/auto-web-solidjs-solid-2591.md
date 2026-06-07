# solidjs/solid #2591 — import manifest instead of reading it

**[View PR on GitHub](https://github.com/solidjs/solid/pull/2591)**

| | |
|---|---|
| **Author** | @huseeiin |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ryansolid
> Is this the approach we should be taking with the Vite Plugin too? I didn't because of TS. But I'm open to discussing that (in that repo).

### @ryansolid
> Also this PR moved a bunch of other stuff around. So distracts from the actual change.

### @huseeiin
> so long as it will run in the runtime, you should never use node:fs obviously because it won't work in edge

### @ryansolid
> Good point.. yeah I had a runtime helper .. Ok I will change the vite plugin.

### @themavik
> `virtual:asset-manifest` drops `readFileSync` from the server entry and reads the emitted JSON at bundle time.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
