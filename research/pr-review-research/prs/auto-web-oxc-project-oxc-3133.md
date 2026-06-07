# oxc-project/oxc #3133 — feat(transformer): add `object-spread` plugin

**[View PR on GitHub](https://github.com/oxc-project/oxc/pull/3133)**

| | |
|---|---|
| **Author** | @magic-akari |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Dunqing
> Oh, this plugin used `@babel/helpers`, we may hold this until #4753 has a conclusion.

### @Dunqing
> we'll just return `babel_external_helper`

### @overlookmotel
> Can I just check: Are we running the conformance tests from this Babel plugin?

### @overlookmotel
> Now how do we disable just the rest-related tests? Or maybe we don't?

### @Dunqing
> This PR is now large, and there will always be conflicts. I think we should merge first and then iterate.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
