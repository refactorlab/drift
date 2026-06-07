# nexu-io/open-design #2355 — feat(runtimes): register AMR (vela) as an ACP stdio agent

**[View PR on GitHub](https://github.com/nexu-io/open-design/pull/2355)**

| | |
|---|---|
| **Author** | @lefarcen |
| **Status** | ✅ merged |
| **Opened** | 2026-05-20 |
| **Repo importance** | ★59,370 · 6,689 forks · score 91,125 |
| **Diff** | +16386 / −451 across 159 files |
| **Engagement** | 26 conversation · 36 inline review comments |

## Top review comments (ranked by reactions)

### @alchemistklk — 1 reactions  
`👀 1`  ·  [link](https://github.com/nexu-io/open-design/pull/2355#issuecomment-4517526642)

> Update pushed in `bea590ac` (`feat(amr): package native cli and refine login ui`).
> 
> Summary:
> - Adds daemon-owned AMR profile resolution through `OPEN_DESIGN_AMR_PROFILE`.
> - Packages an optional native Vela CLI from `OPEN_DESIGN_VELA_CLI_BIN` into mac/Linux/Windows resources.
> - Makes AMR Cloud a separate onboarding option, keeps AMR out of the local CLI picker, and keeps Skip available.
> - Updates AMR login/account surfaces so normal UI says AMR and uses compact icon-only status in the inline switcher.
> - Removes the local CLI Test button from Settings while preserving BYOK test controls.
> 
> Validation:
> - `pnpm --dir apps/daemon exec vitest run -c vitest.config.ts tests/integrations/vela.test.ts tests/integrations/vela.routes.test.ts tests/runtimes/executables.test.ts tests/runtimes/launch.test.ts tests/runtimes/env-and-detection.test.ts`
> - `pnpm --dir apps/web exec vitest run -c vitest.config.ts tests/components/EntryShell.onboarding.test.tsx tests/components/AmrLoginPill.test.tsx tests/components/InlineModelSwitcher.test.tsx tests/components/SettingsDialog.execution.test.tsx`
> - `pnpm --dir tools/pack exec vitest run tests/resources.test.ts tests/win-resources.test.ts`
> - `pnpm --filter @open-design/daemon typecheck`
> - `pnpm --filter @open-design/web typecheck`
> - `pnpm --filter @open-design/tools-pack typecheck`
> - `git diff --check`
> 
> Manual package build for retest:
> - `/Users/alche/.codex/worktrees/1ee6/open-design/.tmp/tools-pack/out/mac/namespaces/amr-retest-login-icon/dmg/Open Design-amr-retest-login-icon.dmg`

### @mrcfps — 1 reactions  
`👀 1`  ·  [link](https://github.com/nexu-io/open-design/pull/2355#issuecomment-4531171775)

> @lefarcen I'm holding off on generating review comments for nexu-io/open-design#2355 because this pull request has merge conflicts right now.
> 
> Please resolve the conflicts with main and push the updated branch. Once that's done, request or wait for the review to run again and I'll take another look.
> 
> <sub>🔁 Powered by <a href="https://github.com/nexu-io/looper">Looper</a> · runner=reviewer · agent=opencode · An autonomous AI dev team for your GitHub repos.</sub>

### @mrcfps — 1 reactions  
`👀 1`  ·  [link](https://github.com/nexu-io/open-design/pull/2355#issuecomment-4532153155)

> @lefarcen I'm holding off on generating review comments for nexu-io/open-design#2355 because this pull request has merge conflicts right now.
> 
> Please resolve the conflicts with main and push the updated branch. Once that's done, request or wait for the review to run again and I'll take another look.
> 
> <sub>🔁 Powered by <a href="https://github.com/nexu-io/looper">Looper</a> · runner=reviewer · agent=opencode · An autonomous AI dev team for your GitHub repos.</sub>

### @mrcfps — 1 reactions  
`👀 1`  ·  [link](https://github.com/nexu-io/open-design/pull/2355#issuecomment-4533680139)

> @lefarcen I'm holding off on generating review comments for nexu-io/open-design#2355 because this pull request has merge conflicts right now.
> 
> Please resolve the conflicts with main and push the updated branch. Once that's done, request or wait for the review to run again and I'll take another look.
> 
> <sub>🔁 Powered by <a href="https://github.com/nexu-io/looper">Looper</a> · runner=reviewer · agent=opencode · An autonomous AI dev team for your GitHub repos.</sub>

### @mrcfps — 1 reactions  
`👀 1`  ·  [link](https://github.com/nexu-io/open-design/pull/2355#issuecomment-4535958661)

> @lefarcen I'm holding off on generating review comments for nexu-io/open-design#2355 because this pull request has merge conflicts right now.
> 
> Please resolve the conflicts with main and push the updated branch. Once that's done, request or wait for the review to run again and I'll take another look.
> 
> <sub>🔁 Powered by <a href="https://github.com/nexu-io/looper">Looper</a> · runner=reviewer · agent=opencode · An autonomous AI dev team for your GitHub repos.</sub>

### @mrcfps — 1 reactions  
`👀 1`  ·  [link](https://github.com/nexu-io/open-design/pull/2355#issuecomment-4539607973)

> @lefarcen I'm holding off on generating review comments for nexu-io/open-design#2355 because this pull request has merge conflicts right now.
> 
> Please resolve the conflicts with main and push the updated branch. Once that's done, request or wait for the review to run again and I'll take another look.
> 
> <sub>🔁 Powered by <a href="https://github.com/nexu-io/looper">Looper</a> · runner=reviewer · agent=opencode · An autonomous AI dev team for your GitHub repos.</sub>


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
