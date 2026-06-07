# tauri-apps/tauri #13993 — feat(cli): check plugin versions for incompatibilities

**[View PR on GitHub](https://github.com/tauri-apps/tauri/pull/13993)**

| | |
|---|---|
| **Author** | @lucasfernog |
| **Status** | ✅ merged |
| **Opened** | 2025-08-12 |
| **Repo importance** | ★107,509 · 3,672 forks · score 127,195 |
| **Diff** | +337 / −45 across 10 files |
| **Engagement** | 15 conversation · 22 inline review comments |

## Top review comments (ranked by reactions)

### @FabianLars — 2 reactions  
`😄 2`  ·  [link](https://github.com/tauri-apps/tauri/pull/13993#issuecomment-3193690685)

> > having to delay a particular plugin feature because tauri is not getting a minor release for a while..
> 
> we pulled out the core stuff into plugins to get around exactly that lol
> 
> edit: i think i misunderstood what you said, just act like i'm not here :)

### @FabianLars — 1 reactions  
`👀 1`  ·  [link](https://github.com/tauri-apps/tauri/pull/13993#issuecomment-3180886664)

> > tldr: Tony is mostly concerned about start up time. Similar for me, after all we removed the cli update check for that reason.
> 
> Well, should have probably tested the PR first before that. At least from my testing this seems to be pretty much instant. Too fast to measure its impact x) Nice job! Let's wait for the critics ( @Legend-Master ) though.

### @FabianLars — 1 reactions  
`👍 1`  ·  [link](https://github.com/tauri-apps/tauri/pull/13993#issuecomment-3191353902)

> With the intention being that we want to include tauri versions in the future as well we're a bit in a weird situation here because not checking the patch versions for plugins can be problematic since plugins are synced on the patch level. Some patch releases contained IPC sensitive changes.
> 
> We could take a step back and require patches to not make any ipc breaking changes (probably means that we mostly get js-only or rust-only PRs) but still keep syncing on patch releases anyway.

### @oscartbeaumont — 1 reactions  
`👍 1`  ·  [link](https://github.com/tauri-apps/tauri/pull/13993#issuecomment-3197852641)

> Thank you everyone for getting this through! So happy to know it's going to be much less likely anyone is going to end up in the same unfortunate position as us with a broken autoupdater in production caused by an `cargo update`.

### @FabianLars — 0 reactions  
`—`  ·  [link](https://github.com/tauri-apps/tauri/pull/13993#issuecomment-3180862131)

> We also talked about this briefly here https://github.com/tauri-apps/tauri/issues/13960 (and in like a hundred discord threads 😂 )
> 
> tldr: Tony is mostly concerned about start up time. Similar for me, after all we removed the cli update check for that reason.

### @FabianLars — 0 reactions  
`—`  ·  [link](https://github.com/tauri-apps/tauri/pull/13993#issuecomment-3180870967)

> oh and technically we sync plugins on patch versions at the moment. if we want the tool to only check minor then we need to make sure we don't have ipc breaking changes in patch releases (even if we consider it a fix). I don't mind either, we just need to agree on something and i guess document it somewhere.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
