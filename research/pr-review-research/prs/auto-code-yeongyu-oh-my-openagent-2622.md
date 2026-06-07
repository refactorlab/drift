# code-yeongyu/oh-my-openagent #2622 — feat(config): object-style fallback_models with per-model settings

**[View PR on GitHub](https://github.com/code-yeongyu/oh-my-openagent/pull/2622)**

| | |
|---|---|
| **Author** | @RaviTharuma |
| **Status** | ✅ merged |
| **Opened** | 2026-03-16 |
| **Repo importance** | ★61,138 · 4,947 forks · score 85,924 |
| **Diff** | +2737 / −146 across 36 files |
| **Engagement** | 46 conversation · 110 inline review comments |

## Top review comments (ranked by reactions)

### @RaviTharuma — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/2622#issuecomment-4076260850)

> @cubic-dev-ai All active review threads on this PR are resolved and the branch head is updated (`487cf198`). The current red GitHub test job appears to be a CI artifact download/extraction problem rather than a code assertion failure. If you still see a code issue on the latest head, please re-review the current diff state.

### @RaviTharuma — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/2622#issuecomment-4076821631)

> @cubic-dev-ai All inline review comments have been addressed — please re-review.

### @RaviTharuma — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/2622#issuecomment-4077081290)

> @cubic-dev-ai The latest push (`d9f9dd34`) eliminates `getFallbackModelConfig()` entirely from both resolvers — replaced by the hybrid inline approach we discussed. `resolveModelForDelegateTask()` now returns its matched `FallbackEntry` directly, so callers get per-model settings for free when the built-in chain matched. For user-configured `fallback_models` (which lose their settings during flattening), both resolvers do a prefix match against the configured chain, sorted by specificity (longest prefix wins). Net result: -67 lines, same behavior, zero test failures. Please re-review when ready.

### @RaviTharuma — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/2622#issuecomment-4081266941)

> @cubic-dev-ai Both issues in review 3966526937 reference `src/hooks/thinking-block-validator/hook.ts` — that file belongs to PR #2653, not this PR (#2622).
> 
> This PR is about object-style `fallback_models` config. The thinking-block-validator is a separate feature in a separate PR.
> 
> Please re-review against the actual scope of this PR.

### @RaviTharuma — 0 reactions  
`—`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/2622#issuecomment-4071444843)

> Follow-up: the newly reported delegate-task issues are fixed in `31ba06c` and I resolved those review threads. The only remaining unresolved thread is the earlier runtime-fallback SDK limitation one — that path still cannot carry object-level per-prompt settings because the current OpenCode prompt API only accepts `{ model, variant }` there. If upstream support for per-prompt overrides lands later, I can wire that path up too.

### @RaviTharuma — 0 reactions  
`—`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/2622#issuecomment-4073623517)

> Fixed and pushed in `3c0f080a`.
> 
> What changed:
> - Removed unsupported OpenCode prompt payload fields from delegated/background `session.prompt` / `session.promptAsync` bodies:
>   - no `temperature` / `top_p` inside `body.model`
>   - no `body.options`
> - Kept only supported prompt payload fields:
>   - `model: { providerID, modelID }`
>   - top-level `variant`
> - Routed advanced tuning through the correct plugin path instead:
>   - added per-session prompt param store in `src/shared/session-prompt-params-state.ts`
>   - applied `temperature`, `topP`, `reasoningEffort`, `thinking`, and `maxTokens` via `chat.params` in `src/plugin/chat-params.ts`
>   - clear stored params on `session.deleted`
> 
> Also fixed fallback-promotion matching:
> - exact match now wins before prefix match
> - prefix matching now uses `startsWith(configuredModel)` so promoted settings stay aligned with fuzzy resolution, including `gpt-5.4` -> `gpt-5.4o`
> 
> Follow-up suite cleanup included in the same push:
> - Darwin realpath normalization now handles `/private/tmp`
> - config-source skill glob filtering fixed
> - processed command store pruning made amortized/in-place (fixes the 10k-entry timeout)
> - tmux env test updated to snapshot `process.env` once, removing the suite flake
> 
> Validation:
> - `bun run typecheck` ✅
> - focused regression suite for these paths ✅
> - full suite: `4075 pass, 0 fail` ✅


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
