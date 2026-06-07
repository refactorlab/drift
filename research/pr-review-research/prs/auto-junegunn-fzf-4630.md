# junegunn/fzf #4630 — shell: nushell integration scripts

**[View PR on GitHub](https://github.com/junegunn/fzf/pull/4630)**

| | |
|---|---|
| **Author** | @sim590 |
| **Status** | ✅ merged |
| **Opened** | 2025-12-09 |
| **Repo importance** | ★80,879 · 2,806 forks · score 97,099 |
| **Diff** | +1040 / −16 across 13 files |
| **Engagement** | 26 conversation · 129 inline review comments |

## Top review comments (ranked by reactions)

### @sim590 — 9 reactions  
`👍 2 · ❤️ 3 · 👀 4`  ·  [link](https://github.com/junegunn/fzf/pull/4630#issuecomment-3721911578)

> Just want to mention that this is still on my todo list. I'll follow-up on this soon.

### @junegunn — 2 reactions  
`🎉 2`  ·  [link](https://github.com/junegunn/fzf/pull/4630#issuecomment-4525809192)

> Included in https://github.com/junegunn/fzf/releases/tag/v0.73.0

### @fdncred — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/junegunn/fzf/pull/4630#issuecomment-4559674285)

> nice work! I'd love to have conversations about how to better support fzf in nushell.

### @sim590 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/junegunn/fzf/pull/4630#issuecomment-3630634155)

> I just fixed a major bug in 55de1bf. Then, 4f10ad7 fixes a minor thing. And finally, I added support for completing Archlinux pacman packages.
> 
> I think this is ready. I could indeed add more programs for which to provide completion, but I'm going to stop there.

### @junegunn — 1 reactions  
`👍 1`  ·  [link](https://github.com/junegunn/fzf/pull/4630#issuecomment-3649957103)

> Hi, this is interesting. I don't use nushell and have no experience with it, so it will take me some time to get started on reviewing this.
> 
> Also, to incorporate this to the project,  we need to address a few more things:
> 
> - Documentation
> - Alignment with other implementations (bash, zsh, and fish) in terms of functionality and customizability
>     - If this feels too limiting, making this a separate third-party project might be a better option. e.g., https://github.com/Aloxaf/fzf-tab
> - Tests
> - Updates to the install and uninstall scripts
> 
> There is ongoing work to add fish fuzzy completion in https://github.com/junegunn/fzf/pull/4605. You might want to take a look at the discussion there.

### @sim590 — 1 reactions  
`👍 1`  ·  [link](https://github.com/junegunn/fzf/pull/4630#issuecomment-4310377401)

> > Coding agents can miss subtle issues that only surface in hands-on use, which matters a lot for an interactive tool like fzf.
> 
> Yes. I agree.
> 
> > Could you share a list of what you manually tested, ideally with screenshots?
> 
> I tested:
> 
> * all keybindings
> * `vim **<TAB>`
>   * with no prefix.
>   * with absolute path prefix
>   * with relative path prefix
>   * with `~`
>   * with `$env.HOME/**`, but that doesn't work. I think that this is a limitation of Nushell's completion dipatcher
> * `^cd **<TAB>`
> * `^kill **<TAB>`
> * `pass **<TAB>`
> * `pacman -S **<TAB>`
> * `pacman -Q **<TAB>`
> 
> All of these work as expected. Here are some screenshots...
> 
> <img width="473" height="142" alt="image" src="https://github.com/user-attachments/assets/2cc674a9-aa23-4ebe-9c0b-109c289f0a8c" />
> 
> <img width="1277" height="618" alt="image" src="https://github.com/user-attachments/assets/5a624ffe-a6cb-4dca-87af-0870f377ba66" />
> 
> <img width="1271" height="598" alt="image" src="https://github.com/user-attachments/assets/6f38f521-2631-49be-ae37-f6fd6ca4f659" />
> 
> <img width="758" height="616" alt="image" src="https://github.com/user-attachments/assets/22c67cd0-565d-4b71-b13d-548f96308ade" />
> 
> <img width="650" height="617" alt="image" src="https://github.com/user-attachments/assets/2e90dc07-2f24-4a06-a513-7de1fc0721cc" />
> 
> <img width="591" height="606" alt="image" src="https://github.com/user-attachments/assets/e159c8cc-bd66-4093-bc46-51734933c40d" />
> 
> vim and `ctrl+t`:
> 
> <img width="596" height="598" alt="image" src="https://github.com/user-attachments/assets/3ce0abd6-0dbc-4525-8ae6-14632168ffbc" />
> 
> <img width="628" he … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
