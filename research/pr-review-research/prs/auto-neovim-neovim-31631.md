# neovim/neovim #31631 — feat(treesitter): async parsing

**[View PR on GitHub](https://github.com/neovim/neovim/pull/31631)**

| | |
|---|---|
| **Author** | @ribru17 |
| **Status** | ✅ merged |
| **Opened** | 2024-12-19 |
| **Repo** | curated review-culture seed |
| **Diff** | +411 / −48 across 13 files |
| **Engagement** | 74 conversation · 147 inline review comments |

## Top review comments (ranked by reactions)

### @justinmk — 20 reactions  
`👍 5 · 🚀 12 · 😄 3`  ·  [link](https://github.com/neovim/neovim/pull/31631#issuecomment-2556853291)

> Just tried this locally, wow, this kicks ass. 
> 
> (For anyone testing: be sure to use `VIMRUNTIME=./runtime/ ./build/bin/nvim --luamod-dev`)
> 
> Notes:
> 
> - Mention in "Performance" section of news.txt
> - Would be nice to [respect 'redrawtime' somehow](https://github.com/neovim/neovim/pull/22420#issuecomment-1446362921), but could track that as a backlog issue.

### @vanaigr — 13 reactions  
`👍 3 · ❤️ 10`  ·  [link](https://github.com/neovim/neovim/pull/31631#issuecomment-2564427840)

> Sorry, the fix I suggested was not covering all cases. The parser also needs to be reset on tree edits.
> Also removed `invalidate()` from async parsing since both things it does (resetting `valid` and the parser) now happen when the tree is edited (in `_iter_regions()` and this patch).
> 
> <details>
> 
> <summary>Patch for  2b07b14eacf31</summary>
> 
> ```diff
> diff --git a/runtime/lua/vim/treesitter/languagetree.lua b/runtime/lua/vim/treesitter/languagetree.lua
> index 5aee2b5211..af9b891af4 100644
> --- a/runtime/lua/vim/treesitter/languagetree.lua
> +++ b/runtime/lua/vim/treesitter/languagetree.lua
> @@ -437,7 +437,6 @@ function LanguageTree:_async_parse(range, on_parse)
>    local function step()
>      -- If buffer was changed in the middle of parsing, reset parse state
>      if self:_buf().changedtick ~= ct then
> -      self:invalidate()
>        ct = self:_buf().changedtick
>        total_parse_time = 0
>      end
> @@ -449,7 +448,6 @@ function LanguageTree:_async_parse(range, on_parse)
>        on_parse(trees)
>        return trees
>      elseif total_parse_time > redrawtime then
> -      self:invalidate()
>        on_parse(nil, 'TIMEOUT')
>      else
>        vim.schedule(step)
> @@ -984,6 +982,7 @@ function LanguageTree:_edit(
>      )
>    end
>  
> +  self._parser:reset()
>    self._regions = nil
>  
>    local changed_range = {
> diff --git a/test/functional/treesitter/parser_spec.lua b/test/functional/treesitter/parser_spec.lua
> index 32f2d87854..a86b3180cc 100644
> --- a/test/functional/treesitter/parser_spec.lua
> +++ b/test/functional/treesitter/parser_spec.lua
> @@ -198,26 +198,19 @@ describe('treesitter parser API', function() … *[truncated]*

### @ribru17 — 11 reactions  
`🎉 3 · 🚀 8`  ·  [link](https://github.com/neovim/neovim/pull/31631#issuecomment-2561334645)

> @justinmk I think this is ready if you want to give it another look

### @lewis6991 — 9 reactions  
`👍 6 · 👀 3`  ·  [link](https://github.com/neovim/neovim/pull/31631#issuecomment-2586447791)

> > Thanks to some digging by @vanaigr, it is clear that the stutters are due to injection processing, specifically in the iter_matches() call in LanguageTree:_get_injections(). This is essentially the only highlighting bottleneck now. Deleting injection queries for the language gives no stutter whatsoever, and completely asynchronous highlighting.
> 
> Another follow-up. The `iter_matches` call can also be broken up over multiple event loop iterations. Just need to add some state to know where to continue from and clear of a buftick change.
> 
> We may also be able to add some optimisations if there are no combined injections in a query (which applies to most languages) without too much complexity.

### @justinmk — 8 reactions  
`👍 8`  ·  [link](https://github.com/neovim/neovim/pull/31631#issuecomment-2567067717)

> > other request I'd like to make now is that we provide some way to make this opt-in/out, and revisit the final default before the release.
> 
> Can make it opt-out I guess. Want this enabled by default.

### @lewis6991 — 7 reactions  
`👍 6 · 👀 1`  ·  [link](https://github.com/neovim/neovim/pull/31631#issuecomment-2561341531)

> I would really like to give this a proper review with the final changes.
> 
> Can we hold off on merging a little bit? The change is only 6 days old with a lot of development and discussion, and it's Xmas eve/ new year.
> 
> ---
> 
> One other request I'd like to make now is that we provide some way to make this opt-in/out, and revisit the final default before the release.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
