# nodejs/undici #2826 — feat: add new dispatch compose

**[View PR on GitHub](https://github.com/nodejs/undici/pull/2826)**

| | |
|---|---|
| **Author** | @metcoder95 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ronag
> I don't see any point in exposing the dispatcher classes themselves (why would you extend them)? Rather I would prefer exposing curry-able factory methods.

### @mcollina
> Missing docs and tests

### @metcoder95
> I've not pushed the tests for the compose feature; still in my machine and constantly failing, on top I forgot to add the extra dispatcher on the constructor.

### @mcollina
> Please integrate this inside the `ProxyAgent`. We shouldn't have special classes for these

### @ronag
> We can also just skip making it an interceptor. I'm fine with that

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
