# neovim/neovim #34009 — feat(pack): add built-in plugin manager `vim.pack`

**[View PR on GitHub](https://github.com/neovim/neovim/pull/34009)**

| | |
|---|---|
| **Author** | @echasnovski |
| **Status** | ✅ merged |
| **Opened** | 2025-05-13 |
| **Repo** | curated review-culture seed |
| **Diff** | +1614 / −0 across 14 files |
| **Engagement** | 63 conversation · 146 inline review comments |

## Top review comments (ranked by reactions)

### @micampe — 7 reactions  
`👍 7`  ·  [link](https://github.com/neovim/neovim/pull/34009#issuecomment-2880163546)

> > Putting a plugin in 'opt/' and load when needed is the same as executing `vim.pack.add()` only when needed. With future user commands that will also be easier to do from command line.
> 
> I am currently using mini.deps, which implements the behavior proposed here, and I have a couple of plugins that I load on demand by calling `add()` when I need to as suggested here.
> 
> This has two side effects that I don't think are desirable: if the plugin is not loaded when `vim.pack.update()` is called the plugin will not be updated and it will be removed when `vim.pack.clean()` is run.
> 
> I think a way to separately indicate "this is a plugin I want installed" and "this is a plugin I want loaded" is useful.
> 
> Whether this results in putting the files in start/opt or just a flag to call or skip packadd I have no opinion on.

### @brianhuster — 6 reactions  
`👍 6`  ·  [link](https://github.com/neovim/neovim/pull/34009#issuecomment-2878364447)

> > Can I ask about the choice never to use the start/ directory?
> 
> Then if you want to disable plugins, you have to manually move them to `opt`. That is bad UX.
> 
> I remember @justinmk once said the Nvim team generally think `pack/*/start` is unnecessary

### @echasnovski — 6 reactions  
`👍 6`  ·  [link](https://github.com/neovim/neovim/pull/34009#issuecomment-2880367306)

> > But "are not used" is now ambiguous. Some plugins "are not used (at startup)"—meaning plugins that are wanted but which users will only sometimes call on with a manual `vim.pack.add`. But it also can mean "are not used (at all)"—meaning plugins that the user wants removed from disk.
> 
> If anything, this is a point towards not having automated "cleaning" in favor of manually selected one (which I'd suggest having in `vim.pack`).
> 
> > I agree with micampe that "a way to separately indicate 'this is a plugin I want installed' and 'this is a plugin I want loaded"' is useful." As he says, one way to do this is with `start/` and `opt/`, but you can also do it other ways.
> 
> Having 'start/' and 'opt/' causes more troubles than brings good. Yes, having an extra `load` flag in `vim.pack.Spec` is possible. At the moment I personally lean towards implementing lockfile (to be able to properly update "plugins that are not yet loaded") plus only manual plugin removal (inside confirmation buffer or `vim.pack.remove()`). Mostly because this both solves actual problems without introducing new fields in spec (which is usually better for usability and maintainability).
> 
> ---
> 
> You (collective) were heard on this topic. Please, let's not continue this discussion here and wait for reviews and (hopefully) merge. After that, these separate subjects can be discussed in a more structured fashion inside separate issues. It is clearly stated as yet work in progress.

### @echasnovski — 5 reactions  
`🚀 5`  ·  [link](https://github.com/neovim/neovim/pull/34009#issuecomment-3032521412)

> Pushed the changes based on the recent round of review:
> - Several renames:
>     - `nvimpack` filetype and URI prefix is `nvim-pack`. I do like the idea of using just `pack`, but it feels a bit too much. Plus there is something in C# that uses `pack://application/...` URI scheme (not sure how much this matters).
>     - `source` in plugin spec is now `src`.
>     - `bang` in `vim.pack.add()` is now a more descriptive `load`. It is boolean for now, but might be extended to be function to take care of plugin loading in the future.
>     - `added` in `vim.pack.get()` output is now `active`. Relevant discussion starts [here](https://github.com/neovim/neovim/pull/34009#discussion_r2178329804).
> - Instead of two dedicated events for each action, there is now only `PackChangedPre` and `PackChanged` with populated `data.kind` ("install", "update", "delete"). Relevant discussion starts [here](https://github.com/neovim/neovim/pull/34009#discussion_r2178600385).
> - There is no dedicated highlight groups for confirmation report. It uses directly already present built-in groups, mostly `DiagnosticXxx` plus `Added` / `Removed`. Titles also use diagnostic groups for consistency and based on #32646. Relevant discussion starts [here](https://github.com/neovim/neovim/pull/34009#discussion_r2178605184).
> 
> Here is the demo of the current state:
> 
> https://github.com/user-attachments/assets/9b6c52ed-f8c4-4a2f-8656-6c9eddd338f2

### @echasnovski — 4 reactions  
`🚀 4`  ·  [link](https://github.com/neovim/neovim/pull/34009#issuecomment-2949889365)

> Pushed fixes/improvements based on recent feedback:
> - Instead of providing progress updates via LSP progress (which is better for user customization), it is now hard-coded with custom `print()` of progress info. This provides better out of the box experience, but I'd like to eventually go the more user-customizable route (be it LSP `$/progress` when there is good built-in handler or `vim.ui.progress`). Using `vim.notify()` instead of `print()` *is* user-customizable, but it results into a separate message for each progress update (I'm personally fine with it, but it *is* a bit too much with something like 'mini.notify' or 'nvim-notify'). Relevant discussion is [here](https://github.com/neovim/neovim/pull/34009#discussion_r2123790910).
> - Default number of threads is increased from 80% of available hardware logical threads to 200%. Relevant discussion is [here](https://github.com/neovim/neovim/pull/34009#discussion_r2126941070).
> - Default `name` now doesn't include possible '.git' suffix of `source`. The `source` itself is not adjusted though (`https://some-site.com/neovim/nvim-lspconfig` and `https://some-site.com/neovim/nvim-lspconfig.git` are not treated as the same source). Relevant discussion starts [here](https://github.com/neovim/neovim/pull/34009#issuecomment-2949025550).
> 
> Here is how the fresh install and update process of 43 plugins looks now:
> 
> https://github.com/user-attachments/assets/7eff3e2c-0f45-46e1-ba5f-e8fe7e6d3205

### @echasnovski — 4 reactions  
`👍 4`  ·  [link](https://github.com/neovim/neovim/pull/34009#issuecomment-2962388079)

> > Both `vim.pack.add()` and `vim.pack.update()` need to have a result shown for each plugin. However, `vim.pack.add()` currently shows 2 results for each plugin, I think this should be reduced to one.
> 
> This feels like 2 results only because they use the same way to display things with current bare bones Nvim. But the one is an entry in overall progress update while the other is the notification about an actually performed action. Those are meant to be displayed without overlapping (either with the future `vim.ui.progress` and/or with customized `vim.notify`), so flickering will not be an issue.
> 
> For the time being (at least while progress update is shown with `print`), I'll push (probably tomorrow) silencing notifications while there is a progress update: i.e. both during install in `vim.pack.add()` and `vim.pack.update(nil, { force = true })`. The `:write` in confirmation buffer will still show those notifications.
> 
> I think also the possible future `vim.pack.add()` functionality (after there is a private lockfile) of ensuring proper `version` and `source` should also come with a notification if plugin is already present on disk.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
