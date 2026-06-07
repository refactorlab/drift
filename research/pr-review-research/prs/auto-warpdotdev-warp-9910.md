# warpdotdev/warp #9910 — Spec: per-tab theme overrides driven by directory and launch configurations (GH478)

**[View PR on GitHub](https://github.com/warpdotdev/warp/pull/9910)**

| | |
|---|---|
| **Author** | @gulsahsarsilmaz |
| **Status** | ✅ merged |
| **Opened** | 2026-05-02 |
| **Repo importance** | ★61,070 · 4,896 forks · score 85,652 |
| **Diff** | +1465 / −0 across 2 files |
| **Engagement** | 23 conversation · 42 inline review comments |

## Top review comments (ranked by reactions)

### @zachlloyd — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/warpdotdev/warp/pull/9910#issuecomment-4364177753)

> @gulsahsarsilmaz this is looking pretty good.  left a few small comments, but moving to ready-to-implement so you can assign to Oz to build

### @zachlloyd — 1 reactions  
`🚀 1`  ·  [link](https://github.com/warpdotdev/warp/pull/9910#issuecomment-4365035786)

> @oz-agent please please implement the specs

### @zachlloyd — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/warpdotdev/warp/pull/9910#issuecomment-4365112137)

> Nah there's a bug here. Oz isn't doing it for some reason. We are looking

### @gulsahsarsilmaz — 0 reactions  
`—`  ·  [link](https://github.com/warpdotdev/warp/pull/9910#issuecomment-4364084314)

> Thanks for the review @oz-for-oss. Pushed v2 (7460929) addressing all three findings, plus a scope expansion that I should flag explicitly.
> 
> ### Oz findings, addressed
> 
> 1. **`ThemeKind` serde vs. product spec's display-name promise.** The `theme:` field on `TabTemplate` and `WindowTemplate` is now `Option<String>`, not `Option<ThemeKind>`. A new `resolve_theme_ref(&str) -> Option<ThemeKind>` helper (specced in `tech.md` §2) accepts both display form (`"Dark City"`) and snake_case (`"dark_city"`), case-insensitive, whitespace-tolerant. The YAML surface is now decoupled from the enum's internal representation.
> 
> 2. **Unknown theme handling.** Direct consequence of #1 — deserialization never fails on theme strings. Resolution runs at apply time; an unresolved name logs one warning identifying the source (launch config + tab, or `directory_overrides` key) and the affected entry falls through to the next resolution layer. Other tabs in the same file and other entries in the same map are unaffected. Pinned in product behavior #11 and in the integration tests under `tech.md` *Testing and validation*.
> 
> 3. **`Appearance::theme_for` ownership / lifetime.** `Appearance` now owns a lazy `theme_cache: parking_lot::RwLock<HashMap<ThemeKind, Arc<WarpTheme>>>` alongside the existing global theme. `theme_for(Option<&ThemeKind>) -> Arc<WarpTheme>` returns the global `Arc` clone for `None` or for the active global theme; otherwise a hit on the cache or a load via the existing global-theme loader path on miss. Invalidation: `AppearanceManager`'s existing `ThemeSettings` subscription clears the … *[truncated]*

### @gulsahsarsilmaz — 0 reactions  
`—`  ·  [link](https://github.com/warpdotdev/warp/pull/9910#issuecomment-4364122633)

> v3 pushed (3cad044) addressing all three findings.
> 
> ### Critical: window default outranking cwd
> 
> You were right — expanding window-level launch-config theme into the `Manual` slot made it top priority, which contradicts the resolution order. Replaced the single `Option<ThemeOverride>` with a `TabThemeState` struct holding three independent slots:
> 
> ```rust
> pub struct TabThemeState {
>     pub manual: Option<ThemeKind>,
>     pub window_default: Option<ThemeKind>,
>     pub cwd_resolved: Option<ThemeKind>,
> }
> 
> impl TabThemeState {
>     pub fn effective<'a>(&'a self, global: &'a ThemeKind) -> &'a ThemeKind {
>         self.manual.as_ref()
>             .or(self.cwd_resolved.as_ref())
>             .or(self.window_default.as_ref())
>             .unwrap_or(global)
>     }
> }
> ```
> 
> `effective()` walks slots in the product-spec priority order, so window default sits below cwd. "Reset theme" now only clears `manual`; if a cwd match was still applicable underneath, the tab redraws with the cwd theme rather than the global. Pinned by both unit tests on `effective()` and an integration test that opens a launch config with a window-level theme into a `directory_overrides`-matched cwd.
> 
> Persistence: `manual` and `window_default` are serialized; `cwd_resolved` is not (it's recomputed on startup from current settings + restored cwd). Window default has to persist because the launch config that set it isn't necessarily reopened on session restore.
> 
> ### Important [SECURITY]: directory paths leaking off-machine
> 
> Right call. Switched to:
> 
> ```rust
> sync_to_cloud: SyncToCloud::Locally,
> private: true,
> ```
> 
> Added an … *[truncated]*

### @gulsahsarsilmaz — 0 reactions  
`—`  ·  [link](https://github.com/warpdotdev/warp/pull/9910#issuecomment-4364184490)

> v4 pushed (28f79f1) addressing all four findings.
> 
> ### Important: save layout dropping window defaults
> 
> Replaced v3's "only emit manual" save rule with a `preserved_override` helper:
> 
> ```rust
> fn preserved_override(state: &TabThemeState) -> Option<&ThemeKind> {
>     state.manual.as_ref().or(state.window_default.as_ref())
> }
> ```
> 
> `From<WindowSnapshot> for WindowTemplate` then:
> 
> - If every tab's preserved override is the same `Some(X)` and no manual differs, emit a single window-level `theme: X` and clear per-tab.
> - Otherwise emit each tab's preserved override at the tab level; window-level `theme:` omitted.
> - Cwd-matched themes are still never emitted (they re-derive on reopen).
> 
> Pinned by two new integration tests: window-level-coalescing round-trip, mixed-pinning case.
> 
> ### Important: Windows path normalization
> 
> Added explicit per-platform rules in product spec #2 and tech spec §4:
> 
> - **Linux:** case-sensitive matching, `/` separator only.
> - **macOS:** case-insensitive matching (matches HFS+/APFS default).
> - **Windows:** case-insensitive, both `/` and `\` accepted as separators, drive letters normalized to uppercase, tilde expands to `%USERPROFILE%`.
> 
> Component-boundary matching uses `Path::components()` (not string operations), with `unicase::eq` for case-insensitive platforms. Cross-platform integration test matrix.
> 
> ### Important [SECURITY]: log redaction
> 
> Added `redacted_key_id(raw_key) -> String` (6-hex-char FxHash, non-cryptographic, stable per key) and a *Diagnostic redaction* contract in tech §4: every warning, error, or diagnostic emitted by the directory_overrides m … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
