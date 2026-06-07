# rust-lang/rustfmt #6275 — `compile_rustfmt` rewrite

**[View PR on GitHub](https://github.com/rust-lang/rustfmt/pull/6275)**

| | |
|---|---|
| **Author** | @benluiwj |
| **Status** | Merged (October 22, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ytmimi
Proposed a `RustfmtRunner` struct design to "associate the `LD_LIBRARY_PATH` with the binary's path" and suggested returning `std::io::Result<std::process::Output>` rather than custom errors.

### @ytmimi
> I'm requesting a few changes here, and then I think we'll be good to go

### @benluiwj
> if the error for `run` be an `IO` error or do you think its better to have a custom error?

### @ytmimi
Asked whether the author planned "to add any unit tests" and offered to demonstrate the program's logging output with specific environment setup instructions.

---
*Note: Several line-level review threads on `check_diff/src/lib.rs` were collapsed ("Show resolved") in the rendered HTML and not retrievable as full verbatim prose via web fetch.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
