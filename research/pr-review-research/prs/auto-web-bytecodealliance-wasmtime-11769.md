# bytecodealliance/wasmtime #11769 — Wasmtime: implement debug instrumentation and basic host API to examine runtime state.

**[View PR on GitHub](https://github.com/bytecodealliance/wasmtime/pull/11769)**

| | |
|---|---|
| **Author** | @cfallin |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @fitzgen
> r=me with the bit about stack tracing using stack maps instead of also debug info

### @fitzgen
> Make StackView own the current frame rather than handing it out. This prevents the current frame (FrameView) from walking away...to be used unsoundly later.

### @cfallin
> The asymptotic efficiency bit is the fundamental one...we should also be concerned about stack maps as they exist today...if we are concerned about this, then we should make the stack maps in general have prefix sharing

### @fitzgen
> I won't draw any lines in the sand here

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
