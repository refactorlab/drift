# PowerShell/PowerShell #25283 — Add single/double quote support for `Join-String` Argument Completer

**[View PR on GitHub](https://github.com/PowerShell/PowerShell/pull/25283)**

| | |
|---|---|
| **Author** | @ArmaanMcleod |
| **Status** | ✅ merged |
| **Opened** | 2025-04-05 |
| **Repo importance** | ★53,793 · 8,334 forks · score 92,085 |
| **Diff** | +416 / −81 across 5 files |
| **Engagement** | 25 conversation · 66 inline review comments |

## Top review comments (ranked by reactions)

### @iSazonov — 1 reactions  
`👍 1`  ·  [link](https://github.com/PowerShell/PowerShell/pull/25283#issuecomment-2817234466)

> @ArmaanMcleod Please remove my two last commits or add new commit to unlock the PR merging.

### @ArmaanMcleod — 0 reactions  
`—`  ·  [link](https://github.com/PowerShell/PowerShell/pull/25283#issuecomment-2789468950)

> Thanks for reviews @iSazonov. Let me know what you think with latest changes 🙂

### @iSazonov — 0 reactions  
`—`  ·  [link](https://github.com/PowerShell/PowerShell/pull/25283#issuecomment-2791460624)

> @ArmaanMcleod Please look test failures.

### @ArmaanMcleod — 0 reactions  
`—`  ·  [link](https://github.com/PowerShell/PowerShell/pull/25283#issuecomment-2795150242)

> > @ArmaanMcleod Please look test failures.
> 
> Thanks @iSazonov. 
> 
> I think test failures are from wildcard pattern like `[*` not being escaped before passing to `WildcardPattern.Get`.
> 
> I fixed this in 09818bba00a5a55fa8c7cff7f4867c2ef484ba2b

### @ArmaanMcleod — 0 reactions  
`—`  ·  [link](https://github.com/PowerShell/PowerShell/pull/25283#issuecomment-2799872836)

> > I hope it is last wave of my comments 😄
> 
> All good @iSazonov. Appreciate the wave of comments since it is helping increase quality here. It is necessary 🙂.

### @ArmaanMcleod — 0 reactions  
`—`  ·  [link](https://github.com/PowerShell/PowerShell/pull/25283#issuecomment-2801301317)

> @iSazonov Good pickup on the unescaping, that was definitely something I didn't want to keep.
> 
> I have done better newline normalization here: 8066ef5ce0c27474473425978dd639b69027feda
> 
> Let me know what you think.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
