# bytecodealliance/wasmtime #10388 — Stack switching: Infrastructure and runtime support

**[View PR on GitHub](https://github.com/bytecodealliance/wasmtime/pull/10388)**

| | |
|---|---|
| **Author** | @frank-emrich |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @fitzgen
> Is there a particular reason this does not use the `InstanceAllocatorImpl::[de]allocate_fiber_stack` methods...That would make it so that this feature automatically integrates with the `wasmtime::Config`

### @fitzgen
> I think it would be best to add a new `wasmtime::runtime::vm::Table` variant for `VMContObj`, the same way that we have different variants for `VMGcRef` tables

### @fitzgen
> The complexity of having multiple kinds of stacks...Keeping things uniform keeps things simpler...can you expand on what difficulties you foresee?

### @fitzgen
> Can you run the function call microbenchmarks...if we are we may need to figure out how to `cfg(...)` some of this stuff so that it only happens when the `stack-switching` feature is enabled

### @fitzgen
> Do you mind splitting out just the `EntryStoreContext` bits...into its own PR? The wasm entry/exit paths are both very fiddly and also perf sensitive

### @fitzgen
> What I am imagining is that...they share the same underlying mechanism...to allocate/deallocate them...This refactoring doesn't need to happen now, before this PR merges

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
