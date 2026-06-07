# firecracker-microvm/firecracker #4428 — Add ACPI support for x86_64

**[View PR on GitHub](https://github.com/firecracker-microvm/firecracker/pull/4428)**

| | |
|---|---|
| **Author** | @bchalios |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

Limited substantive human review prose could be extracted verbatim from the public PR page.

This PR introduces minimal ACPI support for x86_64 (Hardware Reduced mode with FADT, MADT, and DSDT tables; a new `acpi-tables` crate; a VMM-level resource manager for GSI/memory allocation), and deprecates MPTable support in favor of ACPI. The substantive review (from @ShadowCurse, @pb8o, @roypat, @wearyzen) was delivered through inline file-review threads on files such as `dsdt.rs`, `fadt.rs`, `kernel-policy.md`, and `resources.rs`; those threads were resolved and are lazy-loaded by GitHub's JavaScript, so their verbatim text was not present in the static HTML retrieved via web fetch.

The only directly quotable human comment was:

### @wearyzen
> Thanks for posting CHANGELOG for each version!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
