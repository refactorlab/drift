# neovim/neovim #31031 — feat(lsp): add `vim.lsp.config` and `vim.lsp.enable`

**[View PR on GitHub](https://github.com/neovim/neovim/pull/31031)**

| | |
|---|---|
| **Author** | @lewis6991 |
| **Status** | ✅ merged |
| **Opened** | 2024-11-01 |
| **Repo** | curated review-culture seed |
| **Diff** | +601 / −76 across 11 files |
| **Engagement** | 49 conversation · 90 inline review comments |

## Top review comments (ranked by reactions)

### @lewis6991 — 4 reactions  
`🚀 4`  ·  [link](https://github.com/neovim/neovim/pull/31031#issuecomment-2520601121)

> I've tweaked how capabilities are handled so `nvim-cmp` users can do:
> ```lua
>   vim.lsp.config('*', { capablities = require('cmp_nvim_lsp').default_capabilities() })
> ```

### @lewis6991 — 3 reactions  
`🚀 3`  ·  [link](https://github.com/neovim/neovim/pull/31031#issuecomment-2514713435)

> > Depends on when that filetype autocmd/handler is created. Are they created for all filetypes at startup, and thus load all lspconfigs into memory?
> 
> They are created when the user calls `vim.lsp.enable()` (for the servers they want to enable) which would typically be done in `init.lua`. This is no different to how lspconfig works now.
> 
> > TL;DR: Do the configs in lsp/ only apply if you vim.lsp.enable('clangd') without a config, or do they replace vim.lsp.enable entirely? Former good, latter bad.
> 
> This PR (currently) does not include `lsp/` loading. However, `enable` can be wrapped to do this. Only the configs the user specifically `enables` are loaded (as the autocmd is created).
> 
> In order to implement full-lazy, then `filetypes` cannot be an option to the table passed to `vim.lsp.config/enable()`, and instead you would need something like:
> 
> ```lua
> vim.api.nvim_create_autocmd('Filetype', {
>   pattern = 'c',
>   callback = function()
>     vim.opt.lsp:append('clangd')
>   end
> })
> ```
> 
> Could also be done in `ftplugin/c.lua`.
> 
> With this `vim.lsp.enable` would look like:
> 
> ```lua
> function vim.lsp.enable(name, cfg)
>   vim.api.nvim_create_autocmd('FileType', {
>     pattern = '*', -- Need to trigger for all filetypes since we don't know what filetypes this is valid for.
>     callback = function()
>       if vim.tbl_contains(vim.opt:lsp:get(), name) then
>         local config = get_config_from_rtp(name)
>         config = vim.tbl_deep_extend('force', config, cfg)
>         ...
>         vim.lsp.start(config)
>       end
>    end
>   })
> end
> ```
> 
> TLDR: the source of information of `filetype->lsp` needs to go s … *[truncated]*

### @gpanders — 2 reactions  
`👍 1 · 🚀 1`  ·  [link](https://github.com/neovim/neovim/pull/31031#issuecomment-2453514200)

> >What would you want to configure that isn't possible via vim.lsp.ClientConfig?
> 
> `gopls` doesn't have any sort of configuration file so all configuration has to be done through the `settings` field in the initialization request. One example of a project-specific configuration setting is the [`local`](https://cs.opensource.google/go/x/tools/+/refs/tags/gopls/v0.16.2:gopls/doc/settings.md) setting, which doesn't make sense to use globally/for all projects. For one project at work, I also explicitly set the root directory for both `gopls` and `rust-analyzer` (rather than relying on root markers).
> 
> Maybe this is possible using only `vim.lsp.ClientConfig` though.
> 
> >Does your rtp based approach have any significant differences to having something like plugin/luals.lua which just calls vim.lsp.setup?
> 
> I think the only significant difference is the fact that the rtp approach "merges" all of the files found in the rtp for a given server before calling `vim.lsp.start`. This allows a "hierarchy" of configuration settings (e.g. project-local -> plugin -> user).
> 
> >Do you have a small example how that would look like?
> 
> The user creates Lua files under an `lsp/` directory on the runtimepath. Examples: https://github.com/gpanders/dotfiles/tree/master/.config/nvim/lsp. The implementation itself is [here](https://github.com/gpanders/dotfiles/blob/master/.config/nvim/lua/lsp.lua) (it's only about 100 lines of Lua).
> 
> This extends well to project-local configuration. A user can create a `.nvimrc` file which adds any directory to the runtimepath. In my case, I have `set runtimepath+=$PWD/.nvim` … *[truncated]*

### @mfussenegger — 1 reactions  
`👀 1`  ·  [link](https://github.com/neovim/neovim/pull/31031#issuecomment-2453488476)

> >  I can't quite figure where the exact logic for this is
> 
> Do you mean https://github.com/neovim/neovim/blob/0da4d89558a05fb86186253e778510cfd859caea/runtime/lua/vim/lsp.lua#L265 ?
> 
> *Update*: Nevermind, that's already there
> 
> --- 
> 
> > I mentioned in chat a while ago that I've been using my own implementation of "user-friendly LSP configuration" that uses "passive discovery" (by finding files on the user's runtimepath) rather than "active registration" 
> 
> Do you have a small example how that would look like?
> There was also an issue lately in the lsp repo about servers creating a .lsp entry to make them discoverable. See https://github.com/microsoft/language-server-protocol/issues/2051, which might be related?

### @lewis6991 — 1 reactions  
`👍 1`  ·  [link](https://github.com/neovim/neovim/pull/31031#issuecomment-2454825487)

> > "Non-server specific" means something like "global defaults"?
> 
> No it does not. It means things like border hovers, quickfix handling and settings that have nothing to do with a server. Basically defaults for configs that may pass to `vim.lsp.buf` which are designed to handle multiple servers/clients, and thus their configs are not specific to any one server/client.

### @justinmk — 1 reactions  
`👍 1`  ·  [link](https://github.com/neovim/neovim/pull/31031#issuecomment-2483292007)

> > Is there any objection to `add()`? Otherwise, I slightly prefer `config()` over `enable()`.
> 
> I assume we will need "lookup" and "update", so `add()` wouldn't fit. I'm ok with `config()` or `enable()`.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
