# affaan-m/ECC #1377 — Feat/dashboard gui

**[View PR on GitHub](https://github.com/affaan-m/ECC/pull/1377)**

| | |
|---|---|
| **Author** | @Anish29801 |
| **Status** | ✅ merged |
| **Opened** | 2026-04-12 |
| **Repo importance** | ★208,063 · 31,927 forks · score 340,761 |
| **Diff** | +2460 / −13 across 32 files |
| **Engagement** | 14 conversation · 52 inline review comments |

## Top review comments (ranked by reactions)

### @affaan-m — 0 reactions  
`—`  ·  [link](https://github.com/affaan-m/ECC/pull/1377#issuecomment-4234732039)

> Pushed `deb3b1d` to address the two owner-blocking review points:
> 
> - `ecc2/Cargo.toml`: `vendored-openssl` is now an explicit Cargo feature with `default = ["vendored-openssl"]`, instead of being hardwired into every `git2` build
> - `.opencode/package.json`: `@opencode-ai/plugin` is no longer a runtime dependency; it stays as a peer + dev/build dependency, and `.opencode/package-lock.json` was refreshed to match
> 
> Local validation on this branch:
> - `cargo test -q --manifest-path ecc2/Cargo.toml`
> - `node tests/scripts/build-opencode.test.js`
> - `npm ci --ignore-scripts`
> 
> I kept this push scoped to the owner-requested blockers.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
