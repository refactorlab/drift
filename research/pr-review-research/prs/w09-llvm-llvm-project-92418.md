# llvm/llvm-project #92418 — [LoopVectorizer] Add support for partial reductions

**[View PR on GitHub](https://github.com/llvm/llvm-project/pull/92418)**

| | |
|---|---|
| **Author** | @NickGuy-Arm |
| **Status** | ✅ merged (2024-12-19) |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> Review enforces correct layering — intrinsics + langref must land *before* the optimization that consumes them — and proposes the cleaner architecture (a VPlan-to-VPlan transform) rather than pattern-matching.

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@davemgreen:**
> They might need to come first, or at least be committed first. The intrinsics will need language ref which will need to be agreed upon, and some generic lowering.

**@davemgreen:**
> I think this should be more generic than just 4x wider. I believe an ADDP would be a 2 x wider partial reduction for example.

**@efriedma-quic:**
> It seems a bit weird to me to introduce a new intrinsic that, in the general case, isn't actually a natively supported operation on any target.

**@fhahn:**
> AFAICT this isn't driven by cost at all? Could this be done as VPlan-to-VPlan transform that replaces regular reduction recipes?


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
