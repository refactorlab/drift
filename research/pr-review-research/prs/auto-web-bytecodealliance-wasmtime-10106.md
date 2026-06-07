# bytecodealliance/wasmtime #10106 — add component-model-async/{fused|futures|streams}.wast tests

**[View PR on GitHub](https://github.com/bytecodealliance/wasmtime/pull/10106)**

| | |
|---|---|
| **Author** | @dicej |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @alexcrichton
> Ok I'm trying to decipher `trampoline.rs` but if it's ok with you I'd prefer to ask for more documentation first before diving further into these methods. Currently there's very little documentation on how things are set up and understanding enough to be able to review this PR I think would require cross-referencing both all the details in the spec along with Wasmtime internal implementation details.

### @alexcrichton
> I'm sorry I know I sound like a broken record but I'm personally still very lost trying to understand this...I also think it'd be valuable to have enough local documentation to not require that because although I can do that it would also be required for any future readers as well.

### @alexcrichton
> Mind documenting this parameter above? (perhaps documenting that it's currently-unused but soon-to-be-used as well)

### @dicej
> To be clear: I absolutely agree that more docs and comments are needed -- I've only added a bit of that so far but plan to add more. Feel free to ignore this PR until that's done.

### @dicej
> I've rebooted this PR based on the latest code in the `wasip3-prototyping` repo. There are lot more comments in the fused adapter code now; let me know if more are needed or the existing ones are unclear.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
