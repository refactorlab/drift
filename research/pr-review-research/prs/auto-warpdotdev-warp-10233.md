# warpdotdev/warp #10233 — Support warp://action/open_file_editor URIs

**[View PR on GitHub](https://github.com/warpdotdev/warp/pull/10233)**

| | |
|---|---|
| **Author** | @niyangup |
| **Status** | ✅ merged |
| **Opened** | 2026-05-06 |
| **Repo importance** | ★61,070 · 4,896 forks · score 85,652 |
| **Diff** | +353 / −20 across 2 files |
| **Engagement** | 27 conversation · 20 inline review comments |

## Top review comments (ranked by reactions)

### @niyangup — 0 reactions  
`—`  ·  [link](https://github.com/warpdotdev/warp/pull/10233#issuecomment-4393929463)

> Updated the URI action name from `open_file` to `open_file_editor` to make the editor-only behavior explicit.
> 
> Validation performed:
> 
> ```bash
> cargo fmt --all --check
> MACOSX_DEPLOYMENT_TARGET=14.0 cargo test test_action_open_file_editor_parse --manifest-path /Users/niyangup/WorkSpace/warp/Cargo.toml
> MACOSX_DEPLOYMENT_TARGET=14.0 cargo test test_open_file_executable_sh_routes_to_execute --manifest-path /Users/niyangup/WorkSpace/warp/Cargo.toml
> ./script/run
> open 'warposs://action/open_file_editor?path=/Users/niyangup/WorkSpace/warp/app/build.rs&line=109&column=1'
> ```
> 
> Note: this local OSS build registers `warposs://`; the same action path is `warplocal://action/open_file_editor` for a local-channel build.
> 
> I also recorded the manual verification and will attach the video to this PR thread.

### @niyangup — 0 reactions  
`—`  ·  [link](https://github.com/warpdotdev/warp/pull/10233#issuecomment-4393968498)

> https://github.com/user-attachments/assets/3f1f3823-bd17-434e-b9ff-f823d2d0aca5

### @niyangup — 0 reactions  
`—`  ·  [link](https://github.com/warpdotdev/warp/pull/10233#issuecomment-4394171898)

> Removed the branch-local PR notes from `README.md`; the PR now keeps the validation details in this thread instead of repository documentation.
> 
> Fresh validation after that cleanup:
> 
> ```bash
> cargo fmt --all --check
> MACOSX_DEPLOYMENT_TARGET=14.0 cargo test test_action_open_file_editor_parse --manifest-path /Users/niyangup/WorkSpace/warp/Cargo.toml
> MACOSX_DEPLOYMENT_TARGET=14.0 cargo test test_open_file_executable_sh_routes_to_execute --manifest-path /Users/niyangup/WorkSpace/warp/Cargo.toml
> ```
> 
> Manual testing evidence is attached above: https://github.com/user-attachments/assets/3f1f3823-bd17-434e-b9ff-f823d2d0aca5

### @niyangup — 0 reactions  
`—`  ·  [link](https://github.com/warpdotdev/warp/pull/10233#issuecomment-4402973712)

> Updated the PR to address the open_file_editor review comments:
> 
> - Restored the existing `open_file(...)` path so `file://` and path actions keep their legacy file-type routing behavior.
> - Added a separate `open_file_editor(...)` handler for `warp://action/open_file_editor` so the URI always opens in Warp's editor, including executable files, instead of executing or ignoring them.
> - Added parser coverage for `line` without `column`.
> - Added `~/dir` expansion for the `path` query parameter and covered it with a test.
> 
> Validation:
> 
> ```bash
> cargo fmt --all --check
> cargo test test_action_open_file_editor_parse --manifest-path /Users/niyangup/WorkSpace/warp/Cargo.toml
> cargo test test_open_file_executable_sh_routes_to_execute --manifest-path /Users/niyangup/WorkSpace/warp/Cargo.toml
> ```
> 
> /oz-review

### @niyangup — 0 reactions  
`—`  ·  [link](https://github.com/warpdotdev/warp/pull/10233#issuecomment-4404419726)

> Updated this PR to address the latest open_file_editor review feedback:
> 
> - Kept the URI action name as `open_file_editor`, matching the human review request and updated the PR title accordingly.
> - Added a separate `classify_open_file_editor_action(...)` guard so `warp://action/open_file_editor` rejects non-openable targets instead of passing arbitrary URI paths into the editor path.
> - Preserved the legacy `file://` behavior: executable shell scripts still route to `ExecuteInSession`.
> - Added coverage for rejecting executable `.sh` targets from `open_file_editor` and for still allowing Rust source files in the editor path.
> 
> Validation:
> 
> ```bash
> cargo fmt --all --check
> cargo test test_action_open_file_editor_parse --manifest-path /Users/niyangup/WorkSpace/warp/Cargo.toml
> cargo test test_open_file_editor --manifest-path /Users/niyangup/WorkSpace/warp/Cargo.toml
> cargo test test_open_file_executable_sh_routes_to_execute --manifest-path /Users/niyangup/WorkSpace/warp/Cargo.toml
> ```
> 
> /oz-review

### @niyangup — 0 reactions  
`—`  ·  [link](https://github.com/warpdotdev/warp/pull/10233#issuecomment-4449014614)

> Addressed the latest `open_file_editor` review feedback in `d1f3720`.
> 
> Changes:
> - kept `classify_open_file_action(...)` focused on the legacy `file://` routing behavior
> - added a separate `can_open_file_editor_path(...)` guard for `warp://action/open_file_editor`
> - allowed editor-openable executable scripts through the `open_file_editor` path
> - preserved the existing `starts_with_shebang(...)` fallback so extensionless non-executable shebang files still open in the editor on the `file://` path
> - kept the existing `~/...` expansion in `parse_open_file_editor_url(...)`
> - preserved the line-only parse coverage and added binary rejection coverage for the editor URI guard
> 
> Validation:
> 
> ```bash
> cargo fmt --all --check
> cargo test test_action_open_file_editor_parse --manifest-path /Users/niyangup/WorkSpace/warp/Cargo.toml
> cargo test test_open_file_editor --manifest-path /Users/niyangup/WorkSpace/warp/Cargo.toml
> cargo test test_open_file_executable_sh_routes_to_execute --manifest-path /Users/niyangup/WorkSpace/warp/Cargo.toml
> cargo test test_open_file_non_executable_sh_routes_to_editor --manifest-path /Users/niyangup/WorkSpace/warp/Cargo.toml
> cargo test test_open_file_non_runnable_shebang_routes_to_editor --manifest-path /Users/niyangup/WorkSpace/warp/Cargo.toml
> ```


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
