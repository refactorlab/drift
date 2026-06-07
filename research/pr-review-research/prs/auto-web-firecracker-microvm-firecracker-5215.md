# firecracker-microvm/firecracker #5215 — PCI host bridge support

**[View PR on GitHub](https://github.com/firecracker-microvm/firecracker/pull/5215)**

| | |
|---|---|
| **Author** | @bchalios |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

Limited substantive human review prose could be extracted verbatim from the public PR page.

This PR adds a PCI host bridge (root complex / root bridge owning the Root bus) so virtio-pci devices can attach to it. It spans ~15 commits: a PCI crate imported from Cloud Hypervisor, 64-bit-capable MMIO memory regions for x86 and aarch64, PCIe segment support with root port and bus infrastructure, ACPI MCFG table support for MMCONFIG, an optional command-line flag to enable PCIe (disabled by default), and snapshotting support. Codecov flagged patch coverage at 33.56% (1,538 lines missing coverage). The substantive review from @ShadowCurse lived in inline file-review threads that were resolved and are lazy-loaded by GitHub's JavaScript, so their verbatim text was not present in the static HTML retrieved via web fetch.

The only directly quotable human comment was:

### @Manciukic
> well done! Looking forward to the integration of virtio-pci!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
