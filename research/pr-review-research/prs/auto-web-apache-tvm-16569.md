# apache/tvm #16569 — [Unity][Parser] Check well-formedness in the parser

**[View PR on GitHub](https://github.com/apache/tvm/pull/16569)**

| | |
|---|---|
| **Author** | @slyubomirsky |
| **Status** | Merged (March 21, 2024), then reverted (March 22, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Lunderberg
> Verifying that the TIR is well-formed as well. Unit test for the `check_well_formed=False` attribute. Using the `check_well_formed=False` attribute instead of `relax.BlockBuilder` for unit tests that require ill-formed inputs.

### @Lunderberg
> I'd say bug in the unit test. The `A0_s1` is a variable generated to represent `A.strides[1]`. The `strides = [s, s]` should probably be `strides = [s, 1]`.

### @Lunderberg
> I think this is a bug in the well-formed checker. The behavior of a `BufferRealize` node depends on whether it is an externally-provided buffer or not.

### @tqchen
> Unfortunately we find that the pr caused an outage of the MLC compilation, seems to relates to `MergeSharedMemoryAllocations` location change.

### @Lunderberg
> Moving `HoistIfThenElse` changed it's ordering relative to user-specified passes in the `tir.add_lower_pass` configuration.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
