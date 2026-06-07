# termux/termux-app #4417 — Fixed: fully consume unknown CSI sequences containing non-numeric parameter byte

**[View PR on GitHub](https://github.com/termux/termux-app/pull/4417)**

| | |
|---|---|
| **Author** | @krobelus |
| **Status** | ✅ merged |
| **Opened** | 2025-03-01 |
| **Repo importance** | ★55,989 · 6,716 forks · score 87,840 |
| **Diff** | +45 / −2 across 1 files |
| **Engagement** | 16 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @agnostic-apollo — 2 reactions  
`👍 2`  ·  [link](https://github.com/termux/termux-app/pull/4417#issuecomment-2724357077)

> Thanks for testing @robertkirkman. That should probably be enough.

### @robertkirkman — 1 reactions  
`🎉 1`  ·  [link](https://github.com/termux/termux-app/pull/4417#issuecomment-2692607538)

> I have compiled and tested this PR
> 
> I can confirm that this passes the test case given in the issue,
> the command `printf '\x1b[=5u'`  no longer prints anything, whereas without this PR it prints `5u`.
> 
> Tested device: Samsung Galaxy S III SPH-L710, Android 7.1.2

### @agnostic-apollo — 1 reactions  
`👍 1`  ·  [link](https://github.com/termux/termux-app/pull/4417#issuecomment-2724347424)

> The only supported byte after a `!` is a `p` as per spec. A double `!!` is not a valid command. Additionally, even `!` is not part of original ECMA-48 standard, as it only allows bit combinations from 03/00 to 03/15, which are `0–9:;<=>?`. Private modes would require starting the sequence with one of the officially supported bit combinations, or publishing a spec.
> 
> >CSI ! p   Soft terminal reset (DECSTR), VT220 and up.
> 
> - https://invisible-island.net/xterm/ctlseqs/ctlseqs.html
> - https://terminalguide.namepad.de/seq/
> - https://vt100.net/docs/vt220-rm/chapter2.html#S2.4.1

### @agnostic-apollo — 0 reactions  
`—`  ·  [link](https://github.com/termux/termux-app/pull/4417#issuecomment-2723824274)

> Test this and let me know, I will merge within next 24 hr.

### @krobelus — 0 reactions  
`—`  ·  [link](https://github.com/termux/termux-app/pull/4417#issuecomment-2724009370)

> I'm not sure if it's easy for me to test but FWIW the changes look good.
> There are some (contrived) cases missing like `CSI ! ! a`; fixing them would require a slightly larger change.

### @agnostic-apollo — 0 reactions  
`—`  ·  [link](https://github.com/termux/termux-app/pull/4417#issuecomment-2724039688)

> You can grab a build from https://github.com/termux/termux-app/actions/runs/13851563135?pr=4417 if you are using github releases instead of F-Droid.
> 
> There is no need to handle invalid sequences as there would be tonne/or infinite possibilities, the above was handled because it was valid, but unsupported by our terminal currently. The `!` is already captured by `ESC_CSI_EXCLAMATION`, but only `CSI ! p` is valid for a DECSTR reset, other parameters would result in error being logged if logging is enabled.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
