# openclaw/openclaw #78595 — Refactor runtime state into SQLite

**[View PR on GitHub](https://github.com/openclaw/openclaw/pull/78595)**

| | |
|---|---|
| **Author** | @steipete |
| **Status** | ✅ merged |
| **Opened** | 2026-05-06 |
| **Repo importance** | ★376,882 · 78,749 forks · score 696,878 |
| **Diff** | +115036 / −106203 across 3085 files |
| **Engagement** | 19 conversation · 371 inline review comments |

## Top review comments (ranked by reactions)

### @jalehman — 0 reactions  
`—`  ·  [link](https://github.com/openclaw/openclaw/pull/78595#issuecomment-4402206349)

> Hey @steipete — I debated between pushing directly to the PR or opening a PR against your PR, but both felt awkward and I remembered a tweet of yours from a while back about “prompt requests” and thought I’d give this a shot. Here’s a prompt with my findings that you can peruse and/or feed into codex:
> 
> ## Prompt for implementation agent
> 
> You are working on OpenClaw PR #78595. Harden this PR's SQLite runtime-state implementation using the mature patterns from https://github.com/martian-engineering/lossless-claw.
> 
> Read the current PR diff and inspect these OpenClaw areas first:
> 
> - `src/state/openclaw-state-db.ts`
> - `src/infra/sqlite-wal.ts`
> - `src/config/sessions/store-backend.sqlite.ts`
> - `src/config/sessions/store-writer.ts`
> - `src/config/sessions/transcript-store.sqlite.ts`
> - `src/config/sessions/transcript-append.ts`
> - `src/infra/state-migrations.ts`
> - `src/commands/backup-shared.ts`
> - `src/infra/backup-create.ts`
> - `src/agents/pi-embedded-runner/run.ts`
> - `docs/reference/session-management-compaction.md`
> - `docs/concepts/agent-loop.md`
> 
> Then inspect the matching lossless-claw reference areas:
> 
> - `https://github.com/martian-engineering/lossless-claw/tree/main/src/db/connection.ts`
> - `https://github.com/martian-engineering/lossless-claw/tree/main/src/transaction-mutex.ts`
> - `https://github.com/martian-engineering/lossless-claw/tree/main/src/db/migration.ts`
> - `https://github.com/martian-engineering/lossless-claw/tree/main/src/plugin/lcm-db-backup.ts`
> - `https://github.com/martian-engineering/lossless-claw/tree/main/src/prune.ts`
> - `https://github.com/martian-engineering/lo … *[truncated]*

### @jalehman — 0 reactions  
`—`  ·  [link](https://github.com/openclaw/openclaw/pull/78595#issuecomment-4412736300)

> @steipete one specific compatibility need from the lossless-claw/context-engine diligence: PR #78595 should expose a stable locator-to-transcript-reader API before merge.
> 
> Right now context engines receive `transcriptLocator`, but the exported SQLite transcript reader path still appears to require `{ agentId, sessionId }`, while the locator parser/scope resolver is internal. That means a context-engine plugin like lossless-claw can either:
> 
> 1. parse `sqlite-transcript://...` manually, which bakes in an internal URL contract, or
> 2. fail to read SQLite-backed transcripts without reaching through OpenClaw internals.
> 
> The smallest compatibility fix I’d recommend is one of these:
> 
> - make `loadSqliteSessionTranscriptEvents` accept `{ transcriptLocator }` directly, or
> - export a supported `parseSqliteSessionTranscriptLocator` / resolver from `openclaw/plugin-sdk/session-store-runtime`.
> 
> That would let lossless-claw migrate cleanly from `sessionFile` / JSONL-path assumptions to locator-based transcript access while keeping old JSONL support for pre-refactor OpenClaw. Without this seam, the PR is mostly compatible in principle, but context engines have to rely on brittle internal parsing to keep working.

### @jeffjhunter — 0 reactions  
`—`  ·  [link](https://github.com/openclaw/openclaw/pull/78595#issuecomment-4412929836)

> # Empirical migration test on a populated install + working merge patch
> 
> I ran this branch against a snapshot of my real `~/.openclaw` (a two-month-old install: 36 sessions, 121 `.jsonl` transcripts, 19,883 event lines, 167 `.bak-*` legacy backups, ~700 MB of state). Sandboxed via `--profile review`; live install untouched. Goal: turn Codex'''s flagged P1s on the legacy-import paths into measured numbers and a tested fix.
> 
> The bug class is already on the PR — Codex flagged "Preserve newer transcript events during legacy import" and "Merge same-session transcript files before replacing rows" at `src/commands/doctor/state-migrations.ts:307`, and "Skip non-primary transcript artifacts during session import" at `:2353`. @jalehman'''s prompt covered the broader migration-replay-safety story (item 8). This comment adds: **what the bugs cost on a real install** + **a concrete, tested merge implementation that uses the schema'''s existing `transcript_event_identities` table**.
> 
> ## Empirical impact (HEAD `e9b01258`)
> 
> Same input, same machine. Only difference is whether the patch below is applied.
> 
> | Metric                                          | Unpatched migration | Patched (merge-based) |
> |-------------------------------------------------|---------------------|------------------------|
> | `transcript_events` rows                        | 6,901               | **8,325** (+1,424, +20.6%) |
> | Live `.jsonl` re-warning every doctor run       | 59                  | **0**                  |
> | Quarantined `.legacy-no-header-<ts>`            | n/a                 | **59** … *[truncated]*

### @100yenadmin — 0 reactions  
`—`  ·  [link](https://github.com/openclaw/openclaw/pull/78595#issuecomment-4413162922)

> I support the database-first direction in `#78595`. Moving runtime state to canonical SQLite stores is the right long-term shape for reliability, multi-entity session handling, and future database-backed features.
> 
> I opened a maintainer-facing follow-up umbrella to keep one specific architecture thread separate from the current migration/security/blocker review lane:
> 
> - umbrella: #79902
> 
> The short version is that the runtime model looks directionally right, but serious downstream and internal consumers still need a small public read seam so they do not have to parse opaque blobs, scan session rows, or reimplement active-branch/session-lineage logic.
> 
> I split the immediate follow-up asks into three narrow slices:
> 
> - #79904 — cursored SQLite transcript read API for companion consumers
> - #79903 — durable session lineage and `sessionId` discovery across rotations
> - #79905 — typed transcript projections/helpers plus a documented companion rebuild contract
> 
> These are intentionally framed as generic platform seams, not as "special support for one plugin":
> 
> - they make future first-party memory/search/export/audit work easier
> - they reduce duplicated parsing and lineage logic across consumers
> - they keep reset/rotation semantics core-owned while still reusable
> 
> I’m deliberately keeping this separate from the live migration/security findings on `#78595`; that review lane should stay focused.
> 
> Question for maintainers: would you prefer these to land as the tail end of `#78595`, or as immediate follow-up PRs on top of the refactor once the core migration lane is settled?

### @100yenadmin — 0 reactions  
`—`  ·  [link](https://github.com/openclaw/openclaw/pull/78595#issuecomment-4413315418)

> I support the database-first direction in `#78595`. After a deeper architecture pass against both this PR and Lossless Claw's current runtime assumptions, I still think the canonical shape is right:
> 
> - OpenClaw SQLite should remain the operational source of truth
> - advanced consumers should adapt to that model rather than pulling JSONL/runtime-file identity back into core
> 
> The remaining gap is narrower and, I think, broadly useful beyond one companion: serious downstream/internal consumers still need a small public read seam so they do not have to parse opaque blobs, scan session rows, or reimplement private branch/lineage logic.
> 
> I opened/updated one umbrella plus three narrow follow-ups for that seam work:
> 
> - umbrella: #79902
> - #79904 — cursored SQLite transcript read API for companion consumers
> - #79903 — durable session lineage and `sessionId` discovery across rotations
> - #79905 — typed transcript projections/helpers plus a documented companion rebuild contract
> 
> Why I think these are worth doing at the platform level, not just "for LCM":
> 
> - `#78595` already has the right internal raw materials, but they are mostly private:
>   - transcript stats/load/replace live in `transcript-store.sqlite.ts`
>   - lineage continuity already lives in `usageFamilyKey` / `usageFamilySessionIds`
>   - active-branch traversal already exists in `session-transcript-readers.ts`
>   - `sessionId -> sessionKey` resolution already exists, but one path still falls back to first match on ambiguity
> - without a public seam, every serious consumer has to duplicate some combination of:
>   - blob parsing over … *[truncated]*

### @100yenadmin — 0 reactions  
`—`  ·  [link](https://github.com/openclaw/openclaw/pull/78595#issuecomment-4413465041)

> Agent-ready correctness follow-up prompts for `#78595`
> 
> Keep these separate from the companion-seam feature stack.
> 
> 1. Onboarding freshness should detect the canonical SQLite runtime store.
> - Work in `src/wizard/setup.migration-import.ts`
> - Replace legacy-dir-only freshness heuristics with logic that can see a live database-first install
> - Acceptance: onboarding/import does not under-report a migrated SQLite runtime
> 
> 2. HTML “Download JSONL” should emit the canonical session header type.
> - Work in `src/auto-reply/reply/export-html/template.js`
> - Match the canonical transcript contract in `src/agents/transcript/session-transcript-types.ts`
> - Acceptance: exported first record uses the same session header type OpenClaw runtime expects
> 
> 3. Doctor state integrity should not credit stale legacy transcript files as sufficient presence.
> - Work in `src/commands/doctor-state-integrity.ts`
> - Align health reporting with the runtime/export reality that SQLite is the operational truth
> - Acceptance: legacy `.jsonl` leftovers do not make a partially migrated install look healthy
> 
> 4. Fix rotated compaction checkpoint snapshot-metadata trimming.
> - Work in `src/gateway/session-compaction-checkpoints.ts` and validate the call flow from `src/agents/pi-embedded-runner/compact.ts`
> - Snapshot metadata is recorded under the source session id; trim cleanup must delete using the source-session owner of the snapshot row, not the rotated post-compaction session id
> - Acceptance: trimming removes both the snapshot transcript and its metadata row for rotated checkpoints
> 
> 5. Fix off-branch compaction marke … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
