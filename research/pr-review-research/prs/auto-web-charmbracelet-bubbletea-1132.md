# charmbracelet/bubbletea #1132 — feat(render): improve renderer; remove flickering

**[View PR on GitHub](https://github.com/charmbracelet/bubbletea/pull/1132)**

| | |
|---|---|
| **Author** | @LeperGnome |
| **Status** | Merged (Oct 30, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @meowgorithm
> We are indeed working on a new renderer, but this is potentially quite helpful in the meantime as you suggest. That said, it's still a very fundamental change, so we will need to test this very thoroughly in a variety of terminals, environments, and situations before we can merge it.

### @aymanbagabas
> We also need to ensure that this is VT100 compliant and works with all terminals out there i.e. Linux Console, Urxvt, Xterm, etc.

### @aymanbagabas
> It would be a huge optimization for remote sessions like SSH. You want to reduce the amount of data sent over the wire as much as possible in such cases...`ansi.CursorDown1` is only 3 bytes compared to the whole line.

### @meowgorithm
> Let's also make a point to test this on Windows. In theory it'll be fine, but we should do our diligence there, just in case.

### @aymanbagabas
> Tested Glow and a some examples on both macOS (Ghostty) and Windows Terminal. All of them run great except for the `package-manager` example. The cursor doesn't go back to the starting position after printing a line.

### @meowgorithm
> Just an update: things look good to us over here. We're going to test a little bit more and if things look good after that we'll plan to merge this next week.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
