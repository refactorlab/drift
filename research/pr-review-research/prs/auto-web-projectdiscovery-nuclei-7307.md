# projectdiscovery/nuclei #7307 — refactor: native tests

**[View PR on GitHub](https://github.com/projectdiscovery/nuclei/pull/7307)**

| | |
|---|---|
| **Author** | @dwisiswant0 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @coderabbitai
> The `defer` for container termination is placed before checking the error from `mongocontainer.Run`. If the container fails to start, `mongodbContainer` could be nil, potentially causing issues in the deferred `TerminateContainer` call.

### @coderabbitai
> The `lib/` package is the public SDK for embedding Nuclei, yet it now imports mock implementations (`MockOutputWriter`, `MockProgressClient`) from the internal test utilities package. While this works within the module, it conflates test scaffolding with production defaults.

### @coderabbitai
> This subtest relies on an external host (`scanme.sh`) which could be unreachable, rate-limited, or have changed certificate status. Consider using a local test server or mocking the SSL behavior to make this test more reliable in CI environments.

### @coderabbitai
> The `unsignedTemplatesRegex` is compiled inside `filterUnsignedTemplatesWarnings`, which is called for every result set. Consider compiling the regex once at package level.

### @coderabbitai
> The defer on Line 61 is bypassed by every `os.Exit` path here, including the normal `os.Exit(m.Run())` on Line 86. That leaks the temp config dir on both setup failures and successful runs.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
