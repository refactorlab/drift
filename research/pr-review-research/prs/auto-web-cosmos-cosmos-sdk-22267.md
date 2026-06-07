# cosmos/cosmos-sdk #22267 — refactor(server/v2): eager config loading

**[View PR on GitHub](https://github.com/cosmos/cosmos-sdk/pull/22267)**

| | |
|---|---|
| **Author** | @kocubinski |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @julienrbrt
> Those new APIs are great. My comments are only nits now. Love the new flow. Could you add yourself as code owner of simapp/v2 and server/v2 btw?

### @tac0turtle
> Approved the changes after examining the refactored command flow, indicating confidence in the design decisions around eager config loading. (Approval without extended written rationale.)

### @coderabbitai
> The error handling could be more descriptive to help with debugging. Consider wrapping errors with additional context.

### @coderabbitai
> The code should validate that critical dependencies are properly initialized after injection for both server and client paths.

### @coderabbitai
> The type assertion could be made type-safe by changing Config() to return *Config directly [rather than requiring assertions].

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
