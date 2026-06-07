# projectdiscovery/nuclei #6290 — build: bump all direct modules

**[View PR on GitHub](https://github.com/projectdiscovery/nuclei/pull/6290)**

| | |
|---|---|
| **Author** | @dwisiswant0 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @coderabbitai
> The change in pkg/fuzz/parts.go now passes the full HTTP request string into `IsParameterFrequent`. Because `normalizeTarget` only strips inputs starting with 'http', this bypasses normalization and causes every distinct request to be treated separately—breaking the intended grouping by host.

### @coderabbitai
> The method name `URL()` suggests it returns a URL, but it now returns the full HTTP request string. This semantic change could break existing code that expects only the URL string.

### @coderabbitai
> While making error handling explicit is good, panicking on connection close failure might be too aggressive for a library function. Network close errors can occur for various reasons and may not warrant terminating the entire program.

### @coderabbitai
> Switching from `github.com/xanzy/go-gitlab` to the official `gitlab.com/gitlab-org/api/client-go` may introduce breaking changes. Please ensure that all usages still exist and have compatible signatures.

### @coderabbitai
> Could you double-check that we indeed want to include `RawTemplate` for third-party-signed templates (not just unsigned ones)? If the goal is strictly 'only drop into the compiled form when verified by projectdiscovery/nuclei-templates,' the current OR-based check may need review.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
