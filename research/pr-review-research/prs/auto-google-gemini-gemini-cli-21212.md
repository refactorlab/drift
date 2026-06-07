# google-gemini/gemini-cli #21212 — feat(ui): implement refreshed UX for Composer layout

**[View PR on GitHub](https://github.com/google-gemini/gemini-cli/pull/21212)**

| | |
|---|---|
| **Author** | @jwhelangoog |
| **Status** | ✅ merged |
| **Opened** | 2026-03-05 |
| **Repo importance** | ★104,966 · 13,991 forks · score 165,925 |
| **Diff** | +1559 / −1343 across 50 files |
| **Engagement** | 15 conversation · 92 inline review comments |

## Top review comments (ranked by reactions)

### @jacob314 — 0 reactions  
`—`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/21212#issuecomment-4029210203)

> ## /review-frontend
> 
> I have reviewed this PR against the Gemini CLI strict development rules and codebase patterns. The overall direction of the UI refresh is great, but there are several critical issues and inconsistencies that need to be addressed before merging.
> 
> ### 1. Hardcoded Feature Toggle (`AppContainer.tsx`)
> The PR description states that the refreshed layout is gated behind the new `ui.footerLayoutRefresh` setting. However, in `packages/cli/src/ui/AppContainer.tsx` (around line 2020), it is hardcoded:
> ```typescript
> const isExperimentalLayout = true;
> ```
> This completely bypasses the feature toggle. It should instead read from `settings.merged.ui.footerLayoutRefresh`.
> 
> ### 2. Settings Schema and Migration Mismatch (`loadingPhrases`)
> There is a major disconnect between `settings.ts`, `settingsSchema.ts`, and the React components:
> * `packages/cli/src/config/settings.ts` updates the `LoadingPhrasesMode` type with entirely new enum values (e.g., `"none"`, `"wit_status"`, `"wit_inline"`, etc.) and changes the migration logic to use a new key: `newUi["loadingPhraseLayout"] = "none";`.
> * **However**, `packages/cli/src/config/settingsSchema.ts` was **never updated**. It still defines `loadingPhrases` with the old enum values (`"tips"`, `"witty"`, `"all"`, `"off"`).
> * In `packages/cli/src/ui/components/Composer.tsx`, the component still reads `settings.merged.ui.loadingPhrases === "tips"`.
> 
> Because of this mismatch, the new `loadingPhraseLayout` setting is silently ignored by the schema, making it unconfigurable by users, and creating false-positive tests in `Composer.test. … *[truncated]*

### @jacob314 — 0 reactions  
`—`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/21212#issuecomment-4034432060)

> Thanks for the updates! The hardcoded toggles and schema changes look good now.
> 
> However, during my review, I found two incomplete implementations in the latest commit that caused the build/tests to fail:
> *   **Migration Bug (`packages/cli/src/config/settings.ts`)**: While the config tests were updated to expect `loadingPhrases: 'off'`, the actual migration code was still writing the old `loadingPhraseLayout: 'none'` format into the user's settings.
> *   **Outdated Test Snapshot (`packages/cli/src/ui/components/StatusDisplay.test.tsx`)**: Fixing the `useLegacyLayout` toggle logic caused the `HookStatusDisplay` component to correctly render during the legacy mode tests, which invalidated an older snapshot.
> 
> I have fixed these locally and they pass the build. I will push the changes to this branch to resolve them.

### @jacob314 — 0 reactions  
`—`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/21212#issuecomment-4036991739)

> Heads up there are some merge conflicts to resolve.

### @keithguerin — 0 reactions  
`—`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/21212#issuecomment-4052645640)

> I've finalized the Refreshed UX with a series of polish improvements and a final settings refactor. This PR promotes the 'modern' 2-row layout to the default experience and addresses all initial feedback from the review process.
> 
> ### Summary of Improvements
> 
> #### 1. Settings Cleanup & Stability
> To address the feedback regarding naming clarity and Boolean consistency, I have refactored the status line settings to use a uniform 'Hide' logic:
> - **Unified 'Hide' Logic**: All tip-related settings now use 'Hide' (Boolean) for consistency (e.g., `ui.hideStatusTips` and `ui.hideStatusWit`).
> - **Clearer Differentiation**: Labels and descriptions now explicitly distinguish between **Startup Tips** (Header) and **Footer Tips** (Status Line).
> - **Automated Migration**: Maintained full backward compatibility. A migration path automatically maps legacy `loadingPhrases`, `statusHints`, and `enableLoadingPhrases` settings to the new booleans without user intervention.
> 
> #### 2. UI & UX Refinements
> - **Ownership Rule**: Distinguished between AI Analysis (**'Thinking...'**) and System Execution (**'Working...'**). Fallback labels now accurately reflect whether Gemini or the local CLI is busy.
> - **Ordered Witty Phrases**: The status line has been reordered so that witty phrases appear *after* the `(esc to cancel, Xs)` timer for better readability.
> - **Stable Shortcuts Hint**: Restored the empty-buffer check for the `? for shortcuts` hint, ensuring it only appears when functional while remaining visible during model turns (unless overridden by a proactive tip).
> - **Divider Fix**: The horizontal … *[truncated]*

### @jacob314 — 0 reactions  
`—`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/21212#issuecomment-4076559798)

> 🤖 *Review from review-frontend (with manual review by Jacob)*
> 
> I have reviewed the changes in PR 21212 (`fix(ui): unify hook status into LoadingIndicator for stable replacement UX`) by Keith Guerin.
> 
> Here is a summary of the changes and my code review feedback.
> 
> ### PR Summary
> 
> This PR aims to unify the status display (specifically for hooks and loading indicators) in `Composer.tsx` into a more stable "replacement UX."
> 
> **Key Changes:**
> 
> 1.  **Refactoring `Composer.tsx` Structure:**
>     *   The way status rows, mini mode, and indicators are rendered has been fundamentally restructured into a new "Stable Footer Architecture."
>     *   It introduces clear boundaries between `Row 1` (multipurpose status: thinking, hooks, wit, tips) and `Row 2` (mode and context summary).
>     *   It creates a `renderAmbientNode` for tips and shortcut hints.
>     *   It creates a `renderStatusNode` which unifies the display of active hooks and standard "thinking/working" loading indicators, removing custom hooks display logic from the main flow and delegating it to `LoadingIndicator`.
> 2.  **Updating `LoadingIndicator`:**
>     *   Extended `LoadingIndicator` to accept new props like `wittyPhrase`, `showWit`, `forceRealStatusOnly`, `spinnerIcon`, and `isHookActive`.
>     *   It now handles displaying witty phrases alongside the standard elapsed time.
>     *   It delegates the actual spinner icon logic down to `GeminiRespondingSpinner`, allowing for custom icons (like hook arrows '↩' and '↪') instead of just the standard dots/rainbow spinner.
>     *   Adjusted the logic for prepending "Thinking..." so i … *[truncated]*

### @keithguerin — 0 reactions  
`—`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/21212#issuecomment-4093645307)

> I've successfully verified the PR locally with a full green test suite (6200+ tests passing across all packages). I also resolved a few regression issues introduced during the recent merge with `main`, including fixing the 'Focus UI' (minimal mode) mode badges and ensuring extension hook names are correctly displayed.
> 
> The branch is now cleanly squashed into a single commit and is ready for final verification by CI.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
