# BurntSushi/ripgrep #2957 — feat(completion): support sourcing zsh completion dynamically

**[View PR on GitHub](https://github.com/BurntSushi/ripgrep/pull/2957)**

| | |
|---|---|
| **Author** | @vegerot |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @BurntSushi
> I've left it in the FAQ and fixed up the wording by adding an appropriate caveat emptor...the 'generate and source' approach is slower. 4ms might not seem like much...but if you accrue 10 of those kinds of things, it starts to pile up into something that is noticeable.

### @BurntSushi
> [Requested review from @okdana for design input on the approach.]

### @okdana
> [Left comments on FAQ.md and rg.zsh regarding implementation details.]

> Note: Several review comments on this PR were marked resolved and showed "Uh oh! There was an error while loading" on the conversation page, obscuring some verbatim text. Only clearly visible comments are captured here.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
