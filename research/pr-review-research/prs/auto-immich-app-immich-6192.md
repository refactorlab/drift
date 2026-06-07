# immich-app/immich #6192 — feat(server): Automatic watching of library folders

**[View PR on GitHub](https://github.com/immich-app/immich/pull/6192)**

| | |
|---|---|
| **Author** | @etnoy |
| **Status** | ✅ merged |
| **Opened** | 2024-01-05 |
| **Repo importance** | ★102,681 · 5,792 forks · score 130,849 |
| **Diff** | +1613 / −113 across 48 files |
| **Engagement** | 18 conversation · 105 inline review comments |

## Top review comments (ranked by reactions)

### @etnoy — 0 reactions  
`—`  ·  [link](https://github.com/immich-app/immich/pull/6192#issuecomment-1878616956)

> > Does this implementation have a way to remove the watcher for a library without restarting the container?
> > 
> > How will the file watching behave when it's running in multiple containers simultaneously?
> 
> It's just a draft still, much work left to be done. I wanted the GitHub actions tests to run

### @mertalev — 0 reactions  
`—`  ·  [link](https://github.com/immich-app/immich/pull/6192#issuecomment-1897144806)

> Polling mode uses much more CPU from what I can tell. Is there a way we can try to watch without polling, but poll if that fails?

### @etnoy — 0 reactions  
`—`  ·  [link](https://github.com/immich-app/immich/pull/6192#issuecomment-1897381203)

> > Polling mode uses much more CPU from what I can tell. Is there a way we can try to watch without polling, but poll if that fails?
> 
> interesting idea. Not sure how that can be detected automatically, however. I think we can default to not use polling and have the user set polling to true. 
> 
> I'm worried that polling cpu usage might kill this feature altogether...

### @mertalev — 0 reactions  
`—`  ·  [link](https://github.com/immich-app/immich/pull/6192#issuecomment-1897414167)

> > I think we can default to not use polling and have the user set polling to true.
> 
> I think that's fine. This is an opt-in feature so we can just make it clear polling should be enabled if using network-based storage.

### @mertalev — 0 reactions  
`—`  ·  [link](https://github.com/immich-app/immich/pull/6192#issuecomment-1897433635)

> Also, chokidar has an `ignoreInitial` field that should probably be enabled. I think if this is set false, it emits `add` events when it finds files as it starts watching.

### @etnoy — 0 reactions  
`—`  ·  [link](https://github.com/immich-app/immich/pull/6192#issuecomment-1897440423)

> > Also, chokidar has an `ignoreInitial` field that should probably be enabled. I think if this is set false, it emits `add` events when it finds files as it starts watching.
> 
> It's enabled, see the library service


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
