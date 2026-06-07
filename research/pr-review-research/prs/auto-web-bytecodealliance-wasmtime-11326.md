# bytecodealliance/wasmtime #11326 — WebAssembly exception-handling support.

**[View PR on GitHub](https://github.com/bytecodealliance/wasmtime/pull/11326)**

| | |
|---|---|
| **Author** | @cfallin |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @fitzgen
> We had talked elsewhere about removing the exception composite type variant and having tags refer to just their function type... This would better align us with the Wasm spec and make it so that there are less new additions to the types registry code...

### @cfallin
> I tried and abandoned that path... pulling on that string seemed to unwind way too much structure and hit too many places that really still wanted a concrete type for an exception object.

### @alexcrichton
> I like this approach personally... something like `StoreContextMut::throw(&mut self, &Rooted<ExnRef>) -> wasmtime::ThrownException` so that way the user doesn't have to create the tombstone themselves...

### @cfallin
> The basic question is: if we return an exception as a GC object boxed in a `Rooted<ExnRef>`... how should we expect this to interact with handle scopes? ...Basically it's a nonlocal/non-composable footgun...

### @alexcrichton
> Given that it's s390x-only though it's probably an endianness issue, perhaps something with a little-endian load needs to be native-endian?

### @cfallin
> s390x turned out to expose a mismatch in the definition of 'spillslot offset'... A win for ISA diversity wrt testing!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
