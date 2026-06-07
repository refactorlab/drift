# rust-lang/cargo #13709 — feat: implement RFC 3553 to add SBOM support

**[View PR on GitHub](https://github.com/rust-lang/cargo/pull/13709)**

| | |
|---|---|
| **Author** | @justahero |
| **Status** | ✅ merged |
| **Opened** | 2024-04-05 |
| **Repo** | curated review-culture seed |
| **Diff** | +1099 / −23 across 17 files |
| **Engagement** | 16 conversation · 143 inline review comments |

## Top review comments (ranked by reactions)

### @justahero — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/rust-lang/cargo/pull/13709#issuecomment-2687552477)

> Huge thank you @arlosi & to the cargo team for investing the time & effort to get this feature integrated. 🎉

### @arlosi — 1 reactions  
`🎉 1`  ·  [link](https://github.com/rust-lang/cargo/pull/13709#issuecomment-2686117265)

> I've updated the PR and it should be ready for another round of review. Notable changes include:
> * The graph is no longer combining dependencies within the same package. This means that things like libs and build scripts within a package get unique nodes in the graph.
> * The SBOM is listed in the JSON output as an output file.
> * Added a test for RUSTC_WRAPPER

### @heisen-li — 0 reactions  
`—`  ·  [link](https://github.com/rust-lang/cargo/pull/13709#issuecomment-2041449986)

> Much respect for your contribution. 
> 
> From my kind reminders, it seems appropriate to modify the documentation of the corresponding sections, e.g. [Configuration](https://doc.rust-lang.org/cargo/reference/config.html#configuration), [Environment Variables](https://doc.rust-lang.org/cargo/reference/environment-variables.html#environment-variables).

### @weihanglo — 0 reactions  
`—`  ·  [link](https://github.com/rust-lang/cargo/pull/13709#issuecomment-2041490664)

> Thanks for the reminder, @heisen-li. Would love to see a doc update, though we should probably focus on the design discussion first, as the location of the configuration is not yet decided. (See <https://github.com/rust-lang/rfcs/pull/3553#discussion_r1442335016>).

### @epage — 0 reactions  
`—`  ·  [link](https://github.com/rust-lang/cargo/pull/13709#issuecomment-2045558105)

> One approach for the docs (if this is looking to be merged) is to put the env and config documentation fragments in the Unstable docs.

### @nazar-pc — 0 reactions  
`—`  ·  [link](https://github.com/rust-lang/cargo/pull/13709#issuecomment-2742550360)

> Is this supposed to work with `cargo rustc` (I hope so)? It doesn't complain about the option, but doesn't produce `*.cargo-sbom.json` file either, while `cargo build` does.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
