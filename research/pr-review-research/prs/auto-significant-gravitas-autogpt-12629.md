# Significant-Gravitas/AutoGPT #12629 — feat(platform): add copilot artifact preview panel

**[View PR on GitHub](https://github.com/Significant-Gravitas/AutoGPT/pull/12629)**

| | |
|---|---|
| **Author** | @ntindle |
| **Status** | ✅ merged |
| **Opened** | 2026-03-31 |
| **Repo importance** | ★184,771 · 46,188 forks · score 374,523 |
| **Diff** | +4267 / −162 across 45 files |
| **Engagement** | 52 conversation · 1195 inline review comments |

## Top review comments (ranked by reactions)

### @ntindle — 0 reactions  
`—`  ·  [link](https://github.com/Significant-Gravitas/AutoGPT/pull/12629#issuecomment-4179088947)

> 2026-04-02 18-37-02.mov
> 
> https://github.com/user-attachments/assets/c5fa7d49-27f2-495f-8b2c-69d48ff26cd5

### @CLAassistant — 0 reactions  
`—`  ·  [link](https://github.com/Significant-Gravitas/AutoGPT/pull/12629#issuecomment-4188376964)

> [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/Significant-Gravitas/AutoGPT?pullRequest=12629) <br/>All committers have signed the CLA.

### @majdyz — 0 reactions  
`—`  ·  [link](https://github.com/Significant-Gravitas/AutoGPT/pull/12629#issuecomment-4188659475)

> @0ubbe — re: the earlier Vitest-revert ask: I've re-added a thin layer of unit tests in db1d54bfc for the pure helpers that autogpt-pr-reviewer flagged as zero-coverage security surface (`classifyArtifact`, `extractWorkspaceArtifacts`, `filePartToArtifactRef`, `parseCSV` via CSVRenderer). These test **public-API observable behavior** only — no component mounting, no mocks of internal state — so they should stay robust across refactors. Happy to pull them back out if you still want the whole Vitest layer gone until the broader testing pattern is defined.

### @majdyz — 0 reactions  
`—`  ·  [link](https://github.com/Significant-Gravitas/AutoGPT/pull/12629#issuecomment-4188971747)

> ## 🧪 E2E Test Report — 13/13 PASS
> 
> Full docker compose stack built no-cache, all services up. Claude Code subscription used for the copilot LLM.
> 
> ### API tests (4/4 PASS)
> | # | Scenario | Result |
> |---|---|---|
> | A1 | `GET /api/workspace/files?limit=2` | 200 with `has_more` ✅ |
> | A2 | `GET /api/workspace/files?limit=2&offset=2` | `offset=2` echoed ✅ |
> | A3 | `POST /api/workspace/files/upload` (text file) | 200 + file metadata ✅ |
> | A4 | `POST /upload` same filename (no overwrite) | 409 conflict ✅ |
> 
> ### UI tests (9/9 PASS)
> 
> **U1-U2 — Copilot before + chat response:**
> ![01-copilot-before](https://raw.githubusercontent.com/Significant-Gravitas/AutoGPT/test-screenshots/pr-12629/test-screenshots/PR-12629/01-copilot-before.png)
> ![02-chat-response](https://raw.githubusercontent.com/Significant-Gravitas/AutoGPT/test-screenshots/pr-12629/test-screenshots/PR-12629/02-chat-response.png)
> 
> **U3 — Artifact panel auto-opens with styled HTML iframe preview (CSP-hardened srcdoc):**
> ![03-artifact-panel](https://raw.githubusercontent.com/Significant-Gravitas/AutoGPT/test-screenshots/pr-12629/test-screenshots/PR-12629/03-artifact-panel.png)
> 
> **U4 — Download button clicked:**
> ![04-download-clicked](https://raw.githubusercontent.com/Significant-Gravitas/AutoGPT/test-screenshots/pr-12629/test-screenshots/PR-12629/04-download-clicked.png)
> 
> **U5 — Maximize (full-width, button swaps to Restore):**
> ![05-maximized](https://raw.githubusercontent.com/Significant-Gravitas/AutoGPT/test-screenshots/pr-12629/test-screenshots/PR-12629/05-maximized.png)
> 
> **U6 — Restore:**
> ![06-restored](https://raw.githubus … *[truncated]*

### @ntindle — 0 reactions  
`—`  ·  [link](https://github.com/Significant-Gravitas/AutoGPT/pull/12629#issuecomment-4198573185)

> > 2026-04-02 18-37-02.mov
> > 
> >  2026-04-02.18-37-02.mov


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
