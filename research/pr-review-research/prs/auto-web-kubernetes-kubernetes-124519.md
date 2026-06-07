# kubernetes/kubernetes #124519 — Remove gcp in-tree cloud provider and credential providers

**[View PR on GitHub](https://github.com/kubernetes/kubernetes/pull/124519)**

| | |
|---|---|
| **Author** | @dims |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sftim
> Removed the last remaining in-tree code for integrating with GCP as cloud provider (cloud controller manager), and code fetching GCP credentials used during container image pulls.

### @jbtk
> This change broke the autoscaler tests...it seems that they might have missed some required migration. Since KEP does not mention any required migration for tests could you have a look?

### @carlory
> This PR switches the provider implement to `NULLProvider`, it means that the provider does not do anything useful, it's there only to provide valid --provider cmdline option to allow testing of CSI migration tests.

### @aojea
> These tests that are cloud provider specific have to be moved to the corresponding cloud-provider repo...these tests will not work from this repo since this change

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
