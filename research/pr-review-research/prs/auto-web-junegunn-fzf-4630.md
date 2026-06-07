# junegunn/fzf #4630 — shell: nushell integration scripts

**[View PR on GitHub](https://github.com/junegunn/fzf/pull/4630)**

| | |
|---|---|
| **Author** | @sim590 |
| **Status** | Merged (May 23, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @junegunn
> I'm not a nushell user so I might be missing something, but that the fuzzy completion is not always available is quite confusing to me. `vim **<tab>` works, `ls **<tab>` doesn't.

### @sim590
> These are fundamental limitations of Nushell's completion architecture...Since Nushell 0.103.0, the external completer is no longer invoked for internal commands.

### @junegunn
> Ah, we also need to update fzf/man/man1/fzf.1 Lines 1352 to 1369

### @fdncred
> nice work! I'd love to have conversations about how to better support fzf in nushell.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
