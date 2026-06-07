# syncthing/syncthing #10563 — feat(gui, config): support simple folder grouping (fixes #2070)

**[View PR on GitHub](https://github.com/syncthing/syncthing/pull/10563)**

| | |
|---|---|
| **Author** | @maen-bn |
| **Status** | ✅ merged |
| **Opened** | 2026-02-06 |
| **Repo importance** | ★85,007 · 5,246 forks · score 110,985 |
| **Diff** | +512 / −455 across 6 files |
| **Engagement** | 20 conversation · 9 inline review comments |

## Top review comments (ranked by reactions)

### @calmh — 4 reactions  
`👍 4`  ·  [link](https://github.com/syncthing/syncthing/pull/10563#issuecomment-4188558446)

> I think it would be fine to have in the same, as a single grouping concept.

### @tomasz1986 — 2 reactions  
`👍 2`  ·  [link](https://github.com/syncthing/syncthing/pull/10563#issuecomment-3865454965)

> Thanks for the screenshots! Not sure what others think, but for me, the current iteration (without the background) looks better 🙂.

### @acolomb — 1 reactions  
`👍 1`  ·  [link](https://github.com/syncthing/syncthing/pull/10563#issuecomment-3862615649)

> Why should this affect the protocol? IMHO folder grouping is a local thing to organize the device's individual folder list. Groups may not mean the same to other users.

### @acolomb — 1 reactions  
`👍 1`  ·  [link](https://github.com/syncthing/syncthing/pull/10563#issuecomment-3864064032)

> > This can be fixed by allowing users to mask /
> 
> Really? That still leaves users needing to bend over backwards to adjust their labels, when they simply do not need a grouping feature. Label is a label, completely free form, already used that way. Semantics can be attached to an additional field, with a special purpose.
> 
> > No probs. I can drop that. I was just following something you said here about adjusting the protocol but I might have misinterpreted it
> 
> That was about protobuf, which we had used to define the configuration structure at the time. I believe we went back to simple go structs since.

### @tomasz1986 — 1 reactions  
`👍 1`  ·  [link](https://github.com/syncthing/syncthing/pull/10563#issuecomment-4188682868)

> Please also push a relevant PR to the Docs, so that https://docs.syncthing.net/users/config#config-option-folder.group works (and the same for device groups, if implemented) 🙂.

### @tomasz1986 — 1 reactions  
`👍 1`  ·  [link](https://github.com/syncthing/syncthing/pull/10563#issuecomment-4201473074)

> I think something is broken regarding device grouping. For some reason, it shows the "self" device in the remote devices list.
> 
> As you can see below, "syncthing1" is the self device, which isn't supposed to be displayed in the list.
> 
> <img width="846" height="300" alt="image" src="https://github.com/user-attachments/assets/cb638d84-f04a-44c2-814d-ca43d9fcd382" />


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
