# DioxusLabs/dioxus #2258 — Hotreloading of `for/if/body`, formatted strings, literals, component props, nested rsx, light CLI rewrite, cli TUI

**[View PR on GitHub](https://github.com/DioxusLabs/dioxus/pull/2258)**

| | |
|---|---|
| **Author** | @jkelleyrtp |
| **Status** | Merged (July 18, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @chungwong
> Does it PR respect ❯ cat .cargo/config.toml [build] rustflags = ["--cfg", "tokio_unstable"]... For some reason it didn't work... RUSTFLAGS="--cfg tokio_unstable" dx serve then everything works.

### @jkelleyrtp
> This is done, actually, but since it requires breaking changes to core, I'm gonna keep it open until we're ready to start merging break PRs.

### @jkelleyrtp
> My ultimate goal with all this work is to slap a little UI designer frontend on top... Drag-and-drop UI builder, app route reloading, integration with gen AI etc.

### @jkelleyrtp
> The TUI perf seems bad - we should test in release mode... Scrolling has way too much momentum sometimes.

### @jkelleyrtp
> merged attributes with combined if-chains might still not be hotreloadable... remove template hotreload logic in core?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
