# code-yeongyu/oh-my-openagent #2643 — feat(settings): add model settings compatibility resolver

**[View PR on GitHub](https://github.com/code-yeongyu/oh-my-openagent/pull/2643)**

| | |
|---|---|
| **Author** | @RaviTharuma |
| **Status** | ✅ merged |
| **Opened** | 2026-03-17 |
| **Repo importance** | ★61,138 · 4,947 forks · score 85,924 |
| **Diff** | +3738 / −273 across 47 files |
| **Engagement** | 20 conversation · 93 inline review comments |

## Top review comments (ranked by reactions)

### @RaviTharuma — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/2643#issuecomment-4076260857)

> @cubic-dev-ai I addressed the active review points and resolved the threads. If you still see an issue on the latest head (`274f9e8b`), please re-review the current diff state rather than the earlier commit context.

### @RaviTharuma — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/2643#issuecomment-4076907699)

> @cubic-dev-ai Thanks for the thorough review. I've addressed the valid points, but I want to push back on several items and also acknowledge where **our own approach** needs fundamental improvement.
> 
> ---
> 
> ## Where Cubic was right (and we fixed correctly)
> 
> These were genuine catches — thank you:
> 
> 1. **Stale session params** when all settings are dropped — real bug, good catch.
> 2. **Code duplication in spawner.ts** (startTask/resumeTask) — extracted a shared helper, cleaner now.
> 3. **Missing `providerList()` error handling** — would have crashed the hook on API failures.
> 4. **Opus detection too narrow** — `claude-3-opus-*` wouldn't have matched.
> 
> ---
> 
> ## Where we blindly followed Cubic and shouldn't have
> 
> ### 1. `"none"` / `"minimal"` reasoningEffort (commit `4e9c41f`)
> 
> Cubic claimed these are "valid and supported in Opencode" at confidence 9. **This is incorrect.** The Vercel AI SDK `reasoningEffort` parameter accepts `low | medium | high`. The `none`/`minimal` values don't exist in any provider's actual API. We added them to the Zod schema anyway, weakening our validation for values that no consumer will ever send.
> 
> **Verdict:** We should revert this. Accepting unknown values "just in case" is the opposite of type safety.
> 
> ### 2. `structuredClone` for options (commit `4e9c41f`)
> 
> Cubic flagged shallow copy of `options` as a mutation risk at confidence 8. In practice, `options` is a flat `Record<string, string | number>` — there are no nested references to mutate. Adding `structuredClone` is a performance penalty for zero safety gain.
> 
> **Verdict:** Over-engineering. The shall … *[truncated]*

### @RaviTharuma — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/2643#issuecomment-4076975600)

> $(cat <<'EOF'
> @cubic-dev-ai I just pushed commit `7607560c` which adds the **provider-agnostic model family detection** module I described in my previous comment.
> 
> ### What this commit adds:
> 
> **`src/shared/model-settings-compatibility.ts`** — New module that resolves `variant` and `reasoningEffort` compatibility using model-ID-based detection instead of hardcoded provider allowlists.
> 
> Key design:
> - `detectModelFamily()` classifies by model ID string alone — `"claude"` in the ID = Claude, `/^o\d/` = OpenAI reasoning, etc.
> - Provider ID is deliberately unused (`_providerID`) — a Claude model is a Claude model whether it comes from `anthropic`, `aws-bedrock`, `google-vertex-anthropic`, or any custom proxy
> - Runtime metadata from `providerList()` capabilities takes precedence over heuristic fallbacks
> - Graceful downgrade via ordered ladders when a requested level is unsupported
> 
> **`src/shared/model-settings-compatibility.test.ts`** — 14 tests covering:
> - Variant/reasoningEffort resolution for all model families
> - Metadata-first approach overriding family heuristics
> - Case normalization (not recorded as a compatibility change)
> - Provider-agnostic detection across arbitrary provider IDs
> - Unknown model families treated conservatively
> 
> All 4164 tests pass. Please re-review.
> EOF
> )

### @RaviTharuma — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/2643#issuecomment-4077074786)

> @cubic-dev-ai Pushed commit \`625813ba\` — **fundamental architectural refactor** of the model-settings-compatibility module.
> 
> ### What changed
> 
> **Before:** 12 near-identical if/else branches, each with a hardcoded allowed-array. A closed \`ModelFamily\` union type that required code changes for every new model family. Gemini, Kimi, GLM, Minimax, DeepSeek, Mistral, Llama all silently dropped to \`"unknown"\` and lost their settings.
> 
> **After:** A single \`FAMILY_CAPABILITIES\` data registry. One row per model family. Zero code changes needed to add a new family — just a registry entry. The 12 if/else branches in \`resolveVariant()\` and \`resolveReasoningEffort()\` are replaced by one generic \`resolveField()\` function.
> 
> ### Key design decisions
> 
> 1. **Capabilities as data, not code** — the registry is a plain \`Record<string, { variants?, reasoningEffort? }>\`. New models = new data, not new branches.
> 
> 2. **Three-tier resolution** with correct reason codes:
>    - Runtime metadata → \`"unsupported-by-model-metadata"\`
>    - Family heuristic → \`"unsupported-by-model-family"\`
>    - Unknown family → \`"unknown-model-family"\`
>    - Known family but field absent (e.g. Claude + reasoningEffort) → \`"unsupported-by-model-family"\` (not "unknown")
> 
> 3. **Barrel export added** — module was dead code before, now exported from \`src/shared/index.ts\`.
> 
> 4. **All 14 existing tests pass unchanged** — the refactor is behavior-preserving.
> 
> Net: -62 lines (85 added, 147 removed). Every model from \`model-requirements.ts\` fallback chains now has family coverage.
> 
> Next: pipeline integration (c … *[truncated]*

### @RaviTharuma — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/2643#issuecomment-4077101832)

> @cubic-dev-ai Pushed commit \`6ac7de55\` — **test coverage for all model families in the registry**.
> 
> ### What this adds
> 
> 29 new tests (43 total, was 14) covering every family in `FAMILY_CAPABILITIES`:
> 
> | Family | Model IDs tested | Variant support | ReasoningEffort |
> |--------|-----------------|-----------------|-----------------|
> | Gemini | `gemini-3.1-pro` | low/medium/high | dropped |
> | Kimi | `kimi-k2.5`, `k2-v2` | low/medium/high | dropped |
> | GLM | `glm-5` | low/medium/high | dropped |
> | Minimax | `minimax-m2.5` | low/medium/high | dropped |
> | DeepSeek | `deepseek-r2` | low/medium/high | dropped |
> | Mistral | `mistral-large-next` | low/medium/high | dropped |
> | Codestral→Mistral | `codestral-2506` | low/medium/high | dropped |
> | Llama | `llama-4-maverick` | low/medium/high | dropped |
> 
> Also tests GPT-5 `xhigh` variant+reasoningEffort support and empty-desired passthrough.
> 
> Each family gets 3 tests:
> 1. Keeps highest supported variant unchanged
> 2. Downgrades unsupported variant (max→high)
> 3. Correctly drops/keeps reasoningEffort based on family capabilities
> 
> 89 assertions across 43 tests, all passing. Please re-review.

### @RaviTharuma — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/2643#issuecomment-4077150170)

> @cubic-dev-ai Pushed \`0dc50c95\` — **unified registry: detection + capabilities in one data structure.**
> 
> ### Before (two separate concerns)
> 
> 1. \`FAMILY_CAPABILITIES\` — a \`Record<string, FamilyCapabilities>\` holding variant/reasoningEffort arrays
> 2. \`detectModelFamily()\` — 15 lines of if/else returning a string key to look up in the record
> 
> Adding a new model required changes in TWO places.
> 
> ### After (single source of truth)
> 
> \`\`\`typescript
> const MODEL_FAMILY_REGISTRY: ReadonlyArray<readonly [string, FamilyDefinition]> = [
>   [\"claude-opus\",      { pattern: /claude(?:-\\d+(?:-\\d+)*)?-opus/, variants: [\"low\", \"medium\", \"high\", \"max\"] }],
>   [\"claude-non-opus\",  { includes: [\"claude\"], variants: [\"low\", \"medium\", \"high\"] }],
>   // ... one row per family, detection + capabilities together
> ]
> \`\`\`
> 
> Detection is now a 6-line loop:
> \`\`\`typescript
> function detectFamily(_providerID: string, modelID: string): FamilyDefinition | undefined {
>   const model = normalizeModelID(modelID).toLowerCase()
>   for (const [, def] of MODEL_FAMILY_REGISTRY) {
>     if (def.pattern?.test(model)) return def
>     if (def.includes?.some((s) => model.includes(s))) return def
>   }
>   return undefined
> }
> \`\`\`
> 
> Returns the \`FamilyDefinition\` directly — no intermediate string key, no separate lookup. \`resolveCompatibleModelSettings\` uses \`family?.variants\` and \`family?.reasoningEffort\` directly.
> 
> **Net -17 lines. 43 tests pass unchanged.** Adding a future model family = one array entry. Adding a future field (e.g. \`thinkingBudget\`) = one property in \`FamilyDefinition\` + … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
