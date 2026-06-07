# rtk-ai/rtk #1741 — feat(hook): add pi support

**[View PR on GitHub](https://github.com/rtk-ai/rtk/pull/1741)**

| | |
|---|---|
| **Author** | @gitbluf |
| **Status** | ✅ merged |
| **Opened** | 2026-05-06 |
| **Repo importance** | ★59,190 · 3,643 forks · score 78,761 |
| **Diff** | +685 / −41 across 8 files |
| **Engagement** | 26 conversation · 2 inline review comments |

## Top review comments (ranked by reactions)

### @gitbluf — 6 reactions  
`🎉 3 · 🚀 3`  ·  [link](https://github.com/rtk-ai/rtk/pull/1741#issuecomment-4481394225)

> @pszymkowiak Thanks for the review, I've just pushed the new commit addressing your comments.

### @borrougagnou — 5 reactions  
`👍 5`  ·  [link](https://github.com/rtk-ai/rtk/pull/1741#issuecomment-4412782137)

> hope this one will really be merged :pray:

### @pszymkowiak — 4 reactions  
`🎉 3 · 😄 1`  ·  [link](https://github.com/rtk-ai/rtk/pull/1741#issuecomment-4478834639)

> Thanks @gitbluf — tested the install/uninstall lifecycle and the `rtk rewrite` exit-code delegation, both solid. The thin-delegate extension is clean. A few things to fix before merge:
> 
> **1. `--dry-run` is not honoured (blocking)**
> - `rtk init --uninstall --agent pi --dry-run` actually deletes the extension file — the `if pi` block in `uninstall()` never reads `dry_run`, it calls `fs::remove_file` unconditionally. A `--dry-run` that mutates the filesystem breaks the flag's contract ("Preview changes without writing any files").
> - `rtk init --agent pi --dry-run` still creates `.pi/extensions/` on disk — `run_pi_mode` discards `dry_run` (`let InitContext { verbose: _, .. }`) so `fs::create_dir_all` runs unguarded. (`write_if_changed` correctly skips the file itself.)
> 
> Please guard both directory creation and file removal behind `dry_run`, and emit `print_dry_run_footer()` on the Pi paths. The existing agent integrations in this same file already do this correctly — take a look at the `cursor` and `codex` blocks in `uninstall()`, and at `run_hermes_mode_at` / `uninstall_hermes_at` for the install/uninstall dry-run pattern. Aligning with those keeps Pi consistent with the rest of the codebase.
> 
> **2. Add dry-run tests**
> The 9 Pi tests don't cover `--dry-run`; a `dry_run` install + uninstall test asserting nothing is written/removed would have caught the above.
> 
> **3. semgrep `filesystem-deletion` (CI)**
> The scan flags `fs::remove_file(&plugin_path)`. The Hermes uninstall a few lines down already handles this with `// nosemgrep: filesystem-deletion -- …` — please apply the same ac … *[truncated]*

### @aeppling — 2 reactions  
`🚀 2`  ·  [link](https://github.com/rtk-ai/rtk/pull/1741#issuecomment-4518435562)

> PR look clean and already had a review so this should be resolvable quickly for a release :)

### @aeppling — 2 reactions  
`🎉 2`  ·  [link](https://github.com/rtk-ai/rtk/pull/1741#issuecomment-4524866182)

> Hey @gitbluf 
> 
> All look good to me,
> Thanks for contributing to RTK and addressing all reviews !
> 
> Will be released in RTK 0.42

### @jeanduplessis — 1 reactions  
`👍 1`  ·  [link](https://github.com/rtk-ai/rtk/pull/1741#issuecomment-4428343187)

> Sorry mate, I'm not a maintainer on this repo. Just a curious bystander hoping this gets merged so I can stop using workarounds.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
