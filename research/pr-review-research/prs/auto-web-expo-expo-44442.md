# expo/expo #44442 — Native modules types, generating typescript types

**[View PR on GitHub](https://github.com/expo/expo/pull/44442)**

| | |
|---|---|
| **Author** | @HubertBer |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @lukmccall
> I like that you split how types are parsed into multiple functions. However, handling a new type will require quite a lot of work and you will have to understand the `mapSwiftTypeToTsType` function too...I would like to make it as little context-dependent as possible.

### @lukmccall
> Do we want to ignore this case for now? Maybe we should throw something here?

### @lukmccall
> Proposed refactoring `scanFilesRecursively` into separate helper functions and adding an explicit return type interface for clarity and maintainability.

### @jakex7
> Multiple comments requesting clarifications on exported API signatures and internal utility function documentation to improve code discoverability.

### @jakex7
> Requested improvements to command argument structure, requesting named-only parameters and clearer option specifications for the CLI interface.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
