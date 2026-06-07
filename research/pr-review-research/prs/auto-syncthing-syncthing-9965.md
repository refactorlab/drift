# syncthing/syncthing #9965 — chore: switch database engine to sqlite (fixes #9954)

**[View PR on GitHub](https://github.com/syncthing/syncthing/pull/9965)**

| | |
|---|---|
| **Author** | @calmh |
| **Status** | ✅ merged |
| **Opened** | 2025-02-23 |
| **Repo importance** | ★85,007 · 5,246 forks · score 110,985 |
| **Diff** | +8311 / −11980 across 146 files |
| **Engagement** | 15 conversation · 32 inline review comments |

## Top review comments (ranked by reactions)

### @bt90 — 2 reactions  
`❤️ 1 · 😄 1`  ·  [link](https://github.com/syncthing/syncthing/pull/9965#issuecomment-2688329499)

> https://github.com/cvilsmeier/go-sqlite-bench
> 
> [ncruces/go-sqlite3](https://github.com/ncruces/go-sqlite3) looks like a promising CGO-free replacement for modernc. The fact that modernc appears to be packaging their own [libc](https://pkg.go.dev/modernc.org/libc) would be reason enough to test the WASM-based driver :sweat_smile:

### @bt90 — 1 reactions  
`👍 1`  ·  [link](https://github.com/syncthing/syncthing/pull/9965#issuecomment-2717474905)

> I don't know the compile time defaults, but we should configure `synchronous` as `NORMAL`, which is the recommended mode when using WAL.
> 
> https://www.sqlite.org/pragma.html#pragma_synchronous

### @bt90 — 1 reactions  
`👍 1`  ·  [link](https://github.com/syncthing/syncthing/pull/9965#issuecomment-2735631631)

> Noticed a missing pragma:
> 
> `temp_store=memory`
> 
> https://www.sqlite.org/tempfiles.html covers what might spill to disk otherwise

### @calmh — 0 reactions  
`—`  ·  [link](https://github.com/syncthing/syncthing/pull/9965#issuecomment-2708350370)

> Current status of various platform builds, after some effort put into cross compilation with cgo:
> 
> <img width="839" alt="Screenshot 2025-03-08 at 16 33 14" src="https://github.com/user-attachments/assets/9e62afe6-6f1b-4858-b20c-0f99df37cd01" />
> 
> https://github.com/syncthing/syncthing/wiki/SQLite-build-notes

### @bt90 — 0 reactions  
`—`  ·  [link](https://github.com/syncthing/syncthing/pull/9965#issuecomment-2708352823)

> What's the rough performance ballpark of CGO vs C-to-Go vs WASM?

### @calmh — 0 reactions  
`—`  ·  [link](https://github.com/syncthing/syncthing/pull/9965#issuecomment-2708356884)

> From just running on my arm64 Mac, both were around ~75% of the performance of the C code, which imho is fine. However I saw an odd bug once on the WASM variant where a query never completed, which I haven't looked into fully yet but which made me make it third choice. I'll post a benchmark...


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
