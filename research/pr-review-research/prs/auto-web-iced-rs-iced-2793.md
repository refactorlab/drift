# iced-rs/iced #2793 — Fix the initial candidate window position

**[View PR on GitHub](https://github.com/iced-rs/iced/pull/2793)**

| | |
|---|---|
| **Author** | @rhysd |
| **Status** | Merged (Feb 13, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @kenz-gelsoft
> I think this is sane fix for the problem I catched earlier on original PR... So this is not a bug of winit but is a cross platform limitation. We need to `set_ime_cursor_area()` before the subsequent Preedit event I guess.

### @rhysd
> One downside on it is that `window.set_ime_allowed` is called every time when the preedit content and cursor rendering is updated. I don't know how `window.set_ime_allowed` is implemented in winit... but the usage would be fairly irregular.

### @kenz-gelsoft
> I proposed merging Allowed and Open states in this PR, but it was not simple to handle in this PR. I think this PR should be included in the first release (0.14 I expects) which supports input method.

### @kenz-gelsoft
> We moved request_input_method() here which called only if cursor is Index arm. This looks the cause of problem 1.

### @rhysd
> The bug is that, although `input_method::Event::Preedit` is emitted from winit correctly with empty content, the preedit content is set to `None`... the window is not cleared.

### @hecrj
> I see! Good catch!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
