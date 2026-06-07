# alacritty/alacritty #8627 — windows: Properly escape command line arguments

**[View PR on GitHub](https://github.com/alacritty/alacritty/pull/8627)**

| | |
|---|---|
| **Author** | @feeiyu |
| **Status** | ✅ merged |
| **Opened** | 2025-07-20 |
| **Repo importance** | ★64,475 · 3,484 forks · score 83,372 |
| **Diff** | +122 / −5 across 5 files |
| **Engagement** | 15 conversation · 13 inline review comments |

## Top review comments (ranked by reactions)

### @feeiyu — 0 reactions  
`—`  ·  [link](https://github.com/alacritty/alacritty/pull/8627#issuecomment-3094424110)

> before fix:
> ![before_fix_args_escape](https://github.com/user-attachments/assets/0fa6010f-4000-4717-a4fa-e9d91f899b23)
> 
> after fix:
> ![fix_args_escape](https://github.com/user-attachments/assets/1c965f7e-2228-4df0-86db-9864d5599384)

### @kchibisov — 0 reactions  
`—`  ·  [link](https://github.com/alacritty/alacritty/pull/8627#issuecomment-3094526329)

> I guess it's this one https://github.com/alacritty/alacritty/issues/3552 ?

### @feeiyu — 0 reactions  
`—`  ·  [link](https://github.com/alacritty/alacritty/pull/8627#issuecomment-3094564930)

> @kchibisov 
> Thanks for linking, this PR also resolves https://github.com/alacritty/alacritty/issues/3552
> ![after_fix_args_escape2](https://github.com/user-attachments/assets/e787de78-8611-4ea9-b5a7-6e18d4b41e3b)

### @kchibisov — 0 reactions  
`—`  ·  [link](https://github.com/alacritty/alacritty/pull/8627#issuecomment-3094569556)

> That what I've guessed, just linked it for context here, since that's the original issue we had.

### @chrisduerr — 0 reactions  
`—`  ·  [link](https://github.com/alacritty/alacritty/pull/8627#issuecomment-3094848149)

> Have you looked at https://github.com/alacritty/alacritty/pull/3857 and its outstanding questions?

### @feeiyu — 0 reactions  
`—`  ·  [link](https://github.com/alacritty/alacritty/pull/8627#issuecomment-3097120774)

> Thanks for the reference. I've checked the closed PR. The remaining issue is some command like `cmd /c` that would interpret the command line literally, should skip the quote logic. (fix me if l'm missing something)
> 
> Can we add a `raw_args` option, similar with what stdlib did in `process::CommandExt raw_arg()`
> 1. Add `raw_args` (default: `true`) to `PtyOptions`. API users (e.g. Zed) would set `false` in `tty::new`  
> 2. Add `--raw_args` flag to the Alacritty command (default: `true` for compatibility)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
