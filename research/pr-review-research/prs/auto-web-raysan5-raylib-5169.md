# raysan5/raylib #5169 — [rcore] Use `FLAG_*` macros where possible

**[View PR on GitHub](https://github.com/raysan5/raylib/pull/5169)**

| | |
|---|---|
| **Author** | @JohnnyCena123 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @raysan5
> I'm concerned about the macro `FLAG_CHECK()`, I think it's not clear enough... I think it could be replaced by `FLAG_IS_SET()` macro

### @raysan5
> Did you test the changes? There is a windows_config_flags example to test some of them...

### @orcmid
> These changes are excessive and impose extensive challenges on reviewers. Also, it is not clear how any of these are related to the subject

### @raysan5
> this is a big change that could potentially break things, this time I'm merging it and reviewing myself carefully but definitely the last time

### @JeffM2501
> This PR breaks IsWindowFocused in GLFW... the state will be inverted... rlImGui non functional in head

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
