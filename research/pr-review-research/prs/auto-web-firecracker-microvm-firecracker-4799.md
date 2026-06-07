# firecracker-microvm/firecracker #4799 — Use `readv` for the RX path of the network device to avoid one memory copy per frame

**[View PR on GitHub](https://github.com/firecracker-microvm/firecracker/pull/4799)**

| | |
|---|---|
| **Author** | @bchalios |
| **Status** | Merged (Oct 7, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @roypat
> I only made it half-way through commit 2 before my lunch break, but dumping these comments already in case they are helpful

### @bchalios (PR description, design rationale)
> We had tried to implement this optimization before but observed performance regression... Recently, we merged improvements... which allow us to parse descriptor chains faster

Note: @ShadowCurse provided extensive feedback across several review rounds focused on the `IoVecDeque` implementation, `DescriptorChain` parsing overhead, and buffer management across multiple proposals. Those discussions lived in inline file-review threads that were resolved and are lazy-loaded by GitHub's JavaScript, so their verbatim text was not present in the static HTML retrieved via web fetch. (Context: this optimization was subsequently reverted in #4841 due to vsock performance regressions, then reimplemented in #4844.) The quotes above are what was directly extractable.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
