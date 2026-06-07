# unslothai/unsloth #5190 — install: support STUDIO_HOME / UNSLOTH_STUDIO_HOME for custom install paths

**[View PR on GitHub](https://github.com/unslothai/unsloth/pull/5190)**

| | |
|---|---|
| **Author** | @danielhanchen |
| **Status** | ✅ merged |
| **Opened** | 2026-04-26 |
| **Repo importance** | ★65,854 · 5,886 forks · score 94,397 |
| **Diff** | +2424 / −173 across 19 files |
| **Engagement** | 65 conversation · 125 inline review comments |

## Top review comments (ranked by reactions)

### @danielhanchen — 1 reactions  
`👀 1`  ·  [link](https://github.com/unslothai/unsloth/pull/5190#issuecomment-4322514809)

> Cycle 4 fixes (151070cd):
> - desktop_auth.rs: honor UNSLOTH_STUDIO_HOME / STUDIO_HOME for .desktop_secret (was hardcoded ~/.unsloth/studio).
> - install.sh / install.ps1 / unsloth_cli/commands/studio.py: when env override equals legacy default, persist UNSLOTH_LLAMA_CPP_PATH=~/.unsloth/llama.cpp to match setup.sh / setup.ps1's legacy-equality branch.
> 
> /gemini review

### @danielhanchen — 1 reactions  
`👀 1`  ·  [link](https://github.com/unslothai/unsloth/pull/5190#issuecomment-4322544357)

> Cycle 5 fixes (19454e7a):
> 
> - New studio/src-tauri/src/studio_root.rs: shared resolver across Tauri (env > marker file > legacy). Tilde expansion (~, ~/, ~\) matches shell/PowerShell/Python.
> - Tauri lookups via shared helper: process.rs, desktop_auth.rs, main.rs (tauri.log path), commands.rs (open_logs_dir), install.rs work_dir.
> - install.sh / install.ps1 (env-mode only): write ~/.unsloth/studio-home marker so desktop launches without shell env vars still resolve the custom root.
> - Non-interactive completion message: print absolute shim path in env-mode (PATH not mutated).
> - unsloth_cli/commands/studio.py: truthy-check vs setdefault so blank parent env doesn't suppress inferred custom root.
> 
> cargo test --bins: 40/40 pass (5 new for studio_root).
> 
> /gemini review

### @danielhanchen — 1 reactions  
`👀 1`  ·  [link](https://github.com/unslothai/unsloth/pull/5190#issuecomment-4322626050)

> Cycle 8 fix (21b4de13):
> 
> - install.sh: compute the real password-DB home (getent / dscl) unconditionally; scrub markers from BOTH \$HOME and the real-home on default / HOME-redirect cleanup. Previously only \$HOME's marker was removed, leaving a stale real-home marker after prior env-mode installs with redirected HOME.
> - install.ps1: build a profile-candidate list (USERPROFILE + GetFolderPath real profile); cleanup branch removes markers from EVERY candidate.
> 
> Cycle 7 sim (commit a2c12684) end-to-end verified: 3 screenshots captured, /chat + /studio rendered, all API calls 200 OK except 2 net::ERR_ABORTED on /api/models/local that recovered on retry (pre-existing React race, unrelated to this PR).
> 
> /gemini review

### @danielhanchen — 1 reactions  
`👀 1`  ·  [link](https://github.com/unslothai/unsloth/pull/5190#issuecomment-4322693689)

> Cycle 10 (12/20 APPROVE -> fixes pushed at 7633aee2):
> 
> Real findings applied:
> - install.sh launcher: default and HOME-redirect installs keep the legacy runtime DATA_DIR=\"\$HOME/.local/share/unsloth\" form. Only env-mode bakes an absolute path. Restores byte-identical default behavior the PR description claims.
> - install.sh / install.ps1: fail-fast when --tauri is combined with UNSLOTH_STUDIO_HOME / STUDIO_HOME. Prevents producing a desktop install the unchanged Tauri app cannot consume.
> - install.sh / install.ps1: skip persistent Desktop / Start-Menu shortcuts in env-override mode (workspace-isolated installs no longer leave launchers pointing at a path the user may delete).
> - install.ps1: re-prepend env-override \$ShimDir AFTER Refresh-SessionPath so a previously-installed legacy User PATH entry doesn't win precedence over the current-session shim.
> 
> Reviewer claim verified false: the apostrophe escape pattern \`s/'/'\\\\''/g\` correctly produces \`'\\''\` (single quote, backslash, two single quotes), not \`'''\`. Smoke-tested with paths like \`/tmp/O'Brien Studio/share\` and \`bash -n\` is clean. Reviewers were misreading the 4-backslash literal in the bash double-quoted string.
> 
> End-to-end probe: passed. 3 screenshots, /chat + /studio rendered, no console errors, no 4xx/5xx (one pre-existing /api/models/local race not introduced by this PR).
> 
> cargo test --bins -- --test-threads=1: 34/34 pass.
> 
> /gemini review

### @danielhanchen — 1 reactions  
`👀 1`  ·  [link](https://github.com/unslothai/unsloth/pull/5190#issuecomment-4322718881)

> Cycle 11 (16/20 APPROVE -> fixes pushed at 2bb19e57):
> 
> Real findings applied:
> - install.sh / install.ps1: env-mode no longer skips create_studio_shortcuts / New-StudioShortcuts entirely. The early-return moved INSIDE those functions, just before the persistent desktop shortcut creation. Runtime launcher (launch-studio.sh / launch-studio.ps1), studio.conf with UNSLOTH_STUDIO_HOME / UNSLOTH_LLAMA_CPP_PATH exports, and icon are always written so env-mode shims still resolve in fresh shells. (Cycle 10's outer gate was over-broad and skipped these critical artifacts -- regression I introduced.)
> 
> - install.sh / install.ps1 --tauri guard: pass through when the override resolves to the legacy default (\$HOME/.unsloth/studio / %USERPROFILE%\\.unsloth\\studio). Desktop app already uses that path; explicit-equality is supported (matches the llama.cpp legacy-equality branch).
> 
> - studio/backend/run.py: when launched directly (bypassing unsloth CLI), export UNSLOTH_STUDIO_HOME / UNSLOTH_LLAMA_CPP_PATH before the rest of the import chain so unsloth-zoo's import-time LLAMA_CPP_DEFAULT_DIR binding picks up the custom-root build. Only sets when STUDIO_ROOT is a real custom override.
> 
> End-to-end probe: 3 screenshots, /chat + /studio rendered, no 4xx/5xx, no console errors.
> cargo test --bins -- --test-threads=1: 34/34 pass.
> 
> /gemini review

### @danielhanchen — 1 reactions  
`👀 1`  ·  [link](https://github.com/unslothai/unsloth/pull/5190#issuecomment-4322740029)

> Cycle 12 (13/6 verdict; sim passed cleanly with 3 screenshots + share/ files confirmed on disk under env-mode):
> 
> Real findings applied (c1966fd0):
> - install.sh / install.ps1: --tauri legacy-equality passthrough strips trailing separators before comparing. UNSLOTH_STUDIO_HOME=\"\$HOME/.unsloth/studio/\" (with trailing slash) is now accepted as legacy-default.
> - studio/backend/main.py: when launched directly via \`uvicorn main:app\` from a custom-root venv (bypassing both unsloth_cli and run.py), export UNSLOTH_STUDIO_HOME / UNSLOTH_LLAMA_CPP_PATH before any unsloth-zoo import.
> 
> Apostrophe escape claim flagged again by one reviewer: confirmed false-positive (\`s/'/'\\\\''/g\` produces \`'\\''\` correctly; verified end-to-end on /tmp/O'Brien Studio).
> 
> cargo test --bins -- --test-threads=1: 34/34 (Tauri unchanged).
> 
> /gemini review


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
