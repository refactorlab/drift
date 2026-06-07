# clap-rs/clap #5891 — Markdown parsing in doc comments

**[View PR on GitHub](https://github.com/clap-rs/clap/pull/5891)**

| | |
|---|---|
| **Author** | @ModProg |
| **Status** | Merged (February 3, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @epage
> Generally, its best to have a commit that adds tests before the feature work. In this case, i would expect it to show the current handling so the diff shows how formatting changes.

### @epage
> This is currently limited to clap_derive and happens during build time, so build time is the only consideration...compatibility with rustdoc is important.

### @dpc
> Have you considered using Djot? I think it might be relevant when Markdown is added to a crate that a lot of people focus very much w.r.t binary size and performance.

### @epage
> As for using a different format, that is unlikely...We aren't locked into one though parity with rustdoc is a bonus.

### @dpc
> It isn't really a different format. It kind of is just a slightly more strict Markdown, AFAICT.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
