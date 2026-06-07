# neovim/neovim #34009 — feat(pack): add built-in plugin manager `vim.pack`

**[View PR on GitHub](https://github.com/neovim/neovim/pull/34009)**

| | |
|---|---|
| **Author** | @echasnovski |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @justinmk
> Beautiful. Thank you @echasnovski for the careful design choices. After resolving comments, I'm in favor of merging this without tests, since we plan to iterate on it anyway and tests can be part of that.

### @telemachus
> Can I ask about the choice never to use the `start/` directory? Unless I'm confused, that makes it impossible to use `vim.pack` to install something that a user prefers to load only sometimes.

### @echasnovski
> Putting a plugin in 'start/' is the same as putting a `vim.pack.add()` line in an 'init.lua' that is executed on every startup. Putting a plugin in 'opt/' and load when needed is the same as executing `vim.pack.add()` only when needed.

### @brianhuster
> If you want to disable plugins, you have to manually move them to `opt`. That is bad UX. I remember @justinmk once said the Nvim team generally think `pack/*/start` is unnecessary

### @MironPascalCaseFan
> Is there already an option to disable confirmation? I would like to replace lazy.nvim with it while preserving the modular config structure...I'm afraid the first init would require me to press confirm 40 times.

### @echasnovski
> On one hand, it is a problem only for the first install, which is not a huge deal. On the other hand, I've added this to the follow up work as part of 'Consider making `vim.pack.add()` more flexible'.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
