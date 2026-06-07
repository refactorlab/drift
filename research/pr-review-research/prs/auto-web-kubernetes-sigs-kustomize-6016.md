# kubernetes-sigs/kustomize #6016 — fix: support helm v4 beside v3

**[View PR on GitHub](https://github.com/kubernetes-sigs/kustomize/pull/6016)**

| | |
|---|---|
| **Author** | @hmilkovi |
| **Status** | Merged (February 5, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @koba1t
> Considering that Helm v3 is likely installed in the environment, I believe we need code and tests that can support both v3 and v4 environments.

### @koba1t
> Please add tests for both v3 and v4 binaries. This ensures backward compatibility in kustomize.

### @koba1t
> After seeing your PR, I realized that it is difficult to balance helmv3 and helmv4 tests with the current test code...could you please modify this PR to include only the following file...I'm thinking of introducing testing for helmv4 in a separate PR.

### @tcaddy
> What can be done to get this across the finish line? I'd like to see #6013 resolved...can you please squash your commits?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
