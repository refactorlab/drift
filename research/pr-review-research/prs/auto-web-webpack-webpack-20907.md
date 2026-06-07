# webpack/webpack #20907 — feat: support cross-module pure detection in inner graph

**[View PR on GitHub](https://github.com/webpack/webpack/pull/20907)**

| | |
|---|---|
| **Author** | @hai-x |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @alexander-akait
> Why we remove it from here? We use isPure in other places, so it can brings some regressions in optimizations

### @hai-x
> Good catch. We ran into this problem before and tried moving it here as a workaround, but it's now properly fixed via `pureConditionByCallExpr`

### @alexander-akait
> can you take a look at copilot review (should we add a test case for such usage), also can you rebase

### @hai-x
> the inner graph currently collects top-level function, class, and variable declarations and doesn't detect top-level `ExpressionStatements`

### @alexander-akait
> Got it, let's improve `ExpressionStatements` (and maybe more) in future too, I see many rooms to improve this more

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
