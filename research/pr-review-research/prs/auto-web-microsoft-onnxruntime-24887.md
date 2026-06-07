# microsoft/onnxruntime #24887 — Add GetCapability/Compile infrastructure for EP ABI

**[View PR on GitHub](https://github.com/microsoft/onnxruntime/pull/24887)**

| | |
|---|---|
| **Author** | @adrianlizarraga |
| **Status** | Merged (June 19, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> Note: much of the design discussion on this PR occurred in code-review threads summarized by the web page. Verbatim quotes are given where captured; remaining items describe the substantive topic of each thread.

### @Copilot AI
> The variable name `type_shape0` is ambiguous. Consider renaming to `type_shape_info_input0`

### @Copilot AI
> The code now takes a ComputeCapability but still refers to `capability.sub_graph`, which no longer exists

### @adrianlizarraga
Responded to API-design feedback on graph/node enumeration and node compute callbacks in the C API surface.

### @edgchen1
Approved the changes after the author addressed documentation and API naming revisions around the `GetData`/`GetConstData` methods.

### @skottmckay
Left review comments on architectural decisions and participated in the EP ABI design discussion.

### @chilo-ms
Engaged in review of the plugin provider interfaces and the EP factory implementation details.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
