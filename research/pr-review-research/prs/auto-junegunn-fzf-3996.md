# junegunn/fzf #3996 — Add keybindings for CTRL, ALT, SHIFT + UP, DOWN, RIGHT, LEFT, HOME, END, BACKSPACE, DELETE & more

**[View PR on GitHub](https://github.com/junegunn/fzf/pull/3996)**

| | |
|---|---|
| **Author** | @masmu |
| **Status** | ✅ merged |
| **Opened** | 2024-09-13 |
| **Repo importance** | ★80,879 · 2,806 forks · score 97,099 |
| **Diff** | +1228 / −117 across 9 files |
| **Engagement** | 25 conversation · 13 inline review comments |

## Top review comments (ranked by reactions)

### @normanr — 3 reactions  
`👍 2 · 🚀 1`  ·  [link](https://github.com/junegunn/fzf/pull/3996#issuecomment-2817095169)

> Does this need to wait for full tcell support of all modifiers in windows, or could it just be annotated (like kitty, iterm2 are) that it's not supported yet? (context: I was hoping to be able to use shift-pageup/down for the preview panel).

### @masmu — 1 reactions  
`👍 1`  ·  [link](https://github.com/junegunn/fzf/pull/3996#issuecomment-2364482699)

> Thanks for the hint!
> 
> But I am trying to get my hands on a windows machine as well because it all depends on what the OS is really gonna send. I will report back after that.

### @masmu — 1 reactions  
`👍 1`  ·  [link](https://github.com/junegunn/fzf/pull/3996#issuecomment-3043834955)

> I would not mind not adding windows support at all. But that probably would demolish the chances of getting this merged, right @junegunn?
> 
> I am gonna try to get things rolling again in [tcell/pull/749](https://github.com/gdamore/tcell/pull/749).

### @junegunn — 1 reactions  
`👍 1`  ·  [link](https://github.com/junegunn/fzf/pull/3996#issuecomment-3044179652)

> It's okay as long as we document the limitation. I assume you're a Linux user, so you might not be able to answer this, but I'm wondering how I can test this on macOS.

### @masmu — 1 reactions  
`👍 1`  ·  [link](https://github.com/junegunn/fzf/pull/3996#issuecomment-3236212107)

> > On a related note, when I enable clear_all_shortcuts on Kitty, I'm unable to paste the clipboard content using CMD-V, which is annoying. So I don't know if I'm going to use the option even though it means I can't utilize these new keys in fzf.
> 
> Have you tried it without clear_all_shortcuts? My expectation is that most of them work and some don't because Kitty has bound internal actions to them.
> 
> Kitty has a set of default keyboard shortcuts to perform certain actions. For example, `Ctrl+Shift+Page Down` to scroll down the page. When you press this shortcut, it is not passed on to your shell, but Kitty intercepts it and executes its internal scroll function to visually scroll up the terminal window.
> In general, it's good to have a sane set of default keyboard shortcuts, and `Ctrl+Shift+Page Down` is certainly one of them. However, this would have made testing this new feature difficult, as some would have been shadowed by Kitty's default keyboard shortcuts. Therefore, I suggested clearing all default keyboard shortcuts so that none of them would interfere with the test.
> For actual use, you should certainly not use clear_all_shortcuts, but instead unbind the key combos in Kitty that you want to use in fzf.

### @junegunn — 1 reactions  
`🚀 1`  ·  [link](https://github.com/junegunn/fzf/pull/3996#issuecomment-3240148493)

> https://github.com/junegunn/fzf/releases/tag/v0.65.2


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
