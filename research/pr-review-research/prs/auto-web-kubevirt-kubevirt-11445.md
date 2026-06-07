# kubevirt/kubevirt #11445 — [release-1.1] Deprecate cpu and memory exceeds alerts

**[View PR on GitHub](https://github.com/kubevirt/kubevirt/pull/11445)**

| | |
|---|---|
| **Author** | @avlitman |
| **Status** | Merged (April 11, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

Note: this PR's discussion was dominated by CI/infrastructure troubleshooting rather than design review of the deprecation itself. The most substantive prose exchanges:

### @enp0s3
> Please note that the previous ginkgo container `errors metrics` deals with deleting and creating the virt-operator role binding, it may affect the access of virt-operator to the api components

### @machadovilaca
> seems strange, in that case I would expect a fail in both...the role binding wouldn't have been restored properly, and the alert should still be firing

### @enp0s3
> However with regards to this PR I think we can merge it since the issue was with the CI.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
