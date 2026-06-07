# cilium/cilium #38388 — CES: add option to create CES directly from pods

**[View PR on GitHub](https://github.com/cilium/cilium/pull/38388)**

| | |
|---|---|
| **Author** | @jshr-w |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @giorio94
> This PR doesn't allow to disable the creation of CEPs yet (due to [1]), but if that was the case (which I assume being a follow-up step), CES would become incompatible with the clustermesh-apiserver.

### @giorio94
> Essentially, this logic [2] should be extended to work with CES as well, starting either one or the other based on the Cilium configuration.

### @joestringer
> It does feel like we should have pushed back more for incremental changes. >1K LoC is generally not an acceptable size for a change.

### @joestringer
> How do we track and resolve the concerns about the operator getting into a state where it can't recover and properly sync back?

### @giorio94
> My suggestion in that respect would be prioritize the scaffolding of the script tests infrastructure and the introduction of a few initial script tests.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
