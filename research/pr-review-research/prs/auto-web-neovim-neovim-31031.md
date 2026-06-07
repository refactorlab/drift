# neovim/neovim #31031 — feat(lsp): add `vim.lsp.config` and `vim.lsp.enable`

**[View PR on GitHub](https://github.com/neovim/neovim/pull/31031)**

| | |
|---|---|
| **Author** | @lewis6991 |
| **Status** | Merged (December 10, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mfussenegger
> I think it would be really great if a root_dir_marker ends up being a general project construct and not tied to lsp.

### @gpanders
> How would this work if I wanted to configure my LSP client differently for a single project?

### @justinmk
> I don't see why they would have different interfaces, in fact it would be strange if they did.

### @mfussenegger
> `lsp.enable()` could be another naming option?

### @lewis6991
> means things like border hovers, quickfix handling and settings that have nothing to do with a server.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
