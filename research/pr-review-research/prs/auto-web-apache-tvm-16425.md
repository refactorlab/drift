# apache/tvm #16425 — [Target] Use LLVM target parser for determining Arm(R) A-Profile Architecture features

**[View PR on GitHub](https://github.com/apache/tvm/pull/16425)**

| | |
|---|---|
| **Author** | @lhutton1 |
| **Status** | Merged (March 27, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @cbalint13
> I agree...all the mentioned target strings are 'non-legit' from llvm point of view

> Addition or subtraction can be done with `+feat` or `-feat`, a.f.a.i.k. there is no such thing as `+no<whatever>` in llvm.

### @lhutton1
> There are many non-trivial conditions for which a feature may(not) be available...The inclusion of some features in a target string can imply other features. For example, '+sve2' implies '+sve'.

### @Lunderberg
> We should not producing an error message when importing TVM

(Requested deferred parsing instead of load-time validation when LLVM lacks support for certain architectures.)

### @lhutton1
> The problem seems to come from `GetLLVMSubtargetInfo(...)` which creates a target machine instance...The reference to the created target machine is lost and the memory is not freed.

### @cbalint13
> all things was 'hand mapped/coded'

(On long-term sustainability: this PR gives TVM "direct LLVM awareness, not needing any hardcoded mappings into static lists (unmaintainable IMHO)".)

### @tqchen
> only have such error message when we attempt to use tags in aprofile

(Requested conditional tag registration rather than erroring during static initialization.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
