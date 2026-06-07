# rtk-ai/rtk #172 — Add structured rtk dotnet support (build/test/restore) with binlog/TRX parsing, robust argument forwarding, and locale-stable fallback behavior

**[View PR on GitHub](https://github.com/rtk-ai/rtk/pull/172)**

| | |
|---|---|
| **Author** | @danielmarbach |
| **Status** | ✅ merged |
| **Opened** | 2026-02-17 |
| **Repo importance** | ★59,190 · 3,643 forks · score 78,761 |
| **Diff** | +4284 / −0 across 12 files |
| **Engagement** | 26 conversation · 5 inline review comments |

## Top review comments (ranked by reactions)

### @pszymkowiak — 6 reactions  
`🎉 4 · 🚀 2`  ·  [link](https://github.com/rtk-ai/rtk/pull/172#issuecomment-4042043801)

> Thanks @danielmarbach for this outstanding contribution! The MSBuild binlog parser is impressive engineering — proper 7-bit varint decoding, gzip decompression, structured record dispatch, plus the TRX and format report parsers. The multi-layer fallback strategy (binlog → text → TRX) is exactly the right approach.
> 
> 89 tests, 86-93% savings on real .NET projects. Solid work.
> 
> I rebased onto `develop` and applied a few maintainer fixes:
> 
> 1. **Dropped hook file changes** — `develop` uses a thin-delegating hook (`rtk rewrite` as single source of truth). The hardcoded bash mapping would conflict with this architecture.
> 
> 2. **Removed binlog temp path from output** — The `Binlog: /tmp/rtk_dotnet_build_<hex>.binlog` line references a temp file already cleaned up. Printing it wastes tokens.
> 
> 3. **Fixed unused variable warnings** — Prefixed `_binlog_path` in format functions after removing the binlog line.
> 
> All 888 tests pass. Merging into `develop`.

### @danielmarbach — 2 reactions  
`👍 2`  ·  [link](https://github.com/rtk-ai/rtk/pull/172#issuecomment-3938973797)

> I think I addressed the feedback plus some additional robustness things I stumbled upon while doing more testing.
> 
> I've also added Format support

### @RoboNET — 2 reactions  
`👍 2`  ·  [link](https://github.com/rtk-ai/rtk/pull/172#issuecomment-4003546167)

> Really interested in this PR getting merged! This would be very useful for my workflow.

### @danielmarbach — 2 reactions  
`🎉 2`  ·  [link](https://github.com/rtk-ai/rtk/pull/172#issuecomment-4006931056)

> Hopefully fixed now. I guess this will be squashed anyway, so I'm not going to attempt to rewrite history

### @danielmarbach — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/rtk-ai/rtk/pull/172#issuecomment-3914702916)

> @davidfowler this might be something of interest to you
> 
> It probably still misses a few things but might be a good start

### @pszymkowiak — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/rtk-ai/rtk/pull/172#issuecomment-3923555135)

> This is an outstanding PR — probably the most thorough community contribution we've received. The binary binlog parser, multi-layer fallback strategy (binlog → text → TRX), and 42 tests
>   show serious engineering. Really impressive work, thank you!                                                                                                                               
>                                                                                                                                                                                              
>   A few things to address before merge:
> 
>   1. Missing hook rewrite (required)
> 
>   Without this, Claude Code will type dotnet build and it won't go through the RTK filter. Every command we support has a corresponding rewrite in .claude/hooks/rtk-rewrite.sh. Please add:
> 
>   # --- .NET ---
>   elif echo "$MATCH_CMD" | grep -qE '^dotnet[[:space:]]+(build|test|restore)([[:space:]]|$)'; then
>     REWRITTEN="${ENV_PREFIX}$(echo "$CMD_BODY" | sed 's/^dotnet/rtk dotnet/')"
> 
>   See the cargo/pytest/ruff sections in the hook file for examples.
> 
>   2. Binlog parse crash on build (bug)
> 
>   In dotnet_cmd.rs, run_dotnet_with_binlog() for "build" does:
>   binlog::parse_build(&binlog_path)?
>   If the binlog is corrupted, this crashes instead of falling back to text. The "test" path already handles this correctly with .unwrap_or_default(). Please use the same pattern for build
>   and restore.
> 
>   3. Regex compiled at runtime in scrub_sensitive_env_vars()
> 
>   This function calls Regex::new() in a loop for every env var on every invocation. Should be … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
