# electron/electron #48911 — feat: allow SF Symbols to be customised

**[View PR on GitHub](https://github.com/electron/electron/pull/48911)**

| | |
|---|---|
| **Author** | @TheCommieAxolotl |
| **Status** | ✅ merged |
| **Opened** | 2025-11-12 |
| **Repo importance** | ★121,543 · 17,236 forks · score 195,486 |
| **Diff** | +193 / −3 across 6 files |
| **Engagement** | 19 conversation · 34 inline review comments |

## Top review comments (ranked by reactions)

### @TheCommieAxolotl — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/electron/electron/pull/48911#issuecomment-4348350508)

> This was broken due to Chromium upstream [removing](https://issues.chromium.org/issues/478100525) the `base::Value::Dict` alias. I have now updated to `base::DictValue`, and build faliures should be fixed.

### @TheCommieAxolotl — 3 reactions  
`👀 3`  ·  [link](https://github.com/electron/electron/pull/48911#issuecomment-4263963991)

> Rebased. This might fix the CI faliures?

### @TheCommieAxolotl — 2 reactions  
`🎉 2`  ·  [link](https://github.com/electron/electron/pull/48911#issuecomment-4191016056)

> Sorry for the delay! 
> 
> CI faliure should be fixed now, and merge conflicts gone.

### @TheCommieAxolotl — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/electron/electron/pull/48911#issuecomment-3721125548)

> For reference of how close the match is, here's an example (`(e)` means electron, others are native):
> 
> <img width="127" height="259" alt="SCR-20260108-iztx" src="https://github.com/user-attachments/assets/34cd6a43-2569-4ea8-93dd-04186affb06a" />

### @nikwen — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/electron/electron/pull/48911#issuecomment-3765858959)

> Thanks for the update! That looks pretty similar indeed. I'll ask an admin to dismiss my review. :)

### @samuelmaddock — 1 reactions  
`👍 1`  ·  [link](https://github.com/electron/electron/pull/48911#issuecomment-3819226820)

> Bumped a comment about adding a deprecation notice.
> https://github.com/electron/electron/pull/48911#discussion_r2742787576
> 
> Also, the changes may need to be rebased to fix the CI errors.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
