# jellyfin/jellyfin #16062 — Query Performance Improvements

**[View PR on GitHub](https://github.com/jellyfin/jellyfin/pull/16062)**

| | |
|---|---|
| **Author** | @Shadowghost |
| **Status** | ✅ merged |
| **Opened** | 2026-01-19 |
| **Repo importance** | ★52,933 · 4,927 forks · score 77,636 |
| **Diff** | +27810 / −3932 across 126 files |
| **Engagement** | 32 conversation · 87 inline review comments |

## Top review comments (ranked by reactions)

### @JPVenson — 137 reactions  
`👍 27 · ❤️ 27 · 🎉 47 · 🚀 23 · 👀 13`  ·  [link](https://github.com/jellyfin/jellyfin/pull/16062#issuecomment-4366178097)

> approved pending testing request from max

### @crobibero — 17 reactions  
`👍 3 · ❤️ 4 · 🎉 3 · 🚀 3 · 👀 4`  ·  [link](https://github.com/jellyfin/jellyfin/pull/16062#issuecomment-3825949140)

> Bringing from chat to PR for visibility
> 
> > I don’t like LinkedChildren. I just want to make sure that we can’t just use the Parent column
> 
> > We can't because a) Parent <-> Child is used for our horrendous Folder logic which we can't just strip out and b) LinkedChildren are used for things like Collections, Playlists, etc. - anything that aggregates
> It's a horrendous mess with Parent, Owner, Children and LinkedChildren
> The issue right now is that LinkedChildren aren't validated or updated, because they are saved as a string on the base item, so no foreign keys, no itegrity or cleanups, that's what my PR essentially fixes schema wise together with the owner referential fix.
> Without these fixes, efficient infinite depth queries are impossible which is the main issue of our perf problem.
> Ideally we'd clean up this mess but that is a major version problem to fix 🙂 
> Technically this change also migrates collections and playlists to be in-db

### @Casuallynoted — 9 reactions  
`👍 3 · ❤️ 2 · 🎉 1 · 🚀 1 · 👀 2`  ·  [link](https://github.com/jellyfin/jellyfin/pull/16062#issuecomment-4187516078)

> One interesting issue I've noticed on this build is that videos seem to pause after exactly 5 seconds. scrubbing to 6 seconds seems to get them playing again but thought I should mention this.

### @Shadowghost — 8 reactions  
`🚀 8`  ·  [link](https://github.com/jellyfin/jellyfin/pull/16062#issuecomment-4188425887)

> Since this PR doesn't change anything in the playback pipeline, that issue should not originate here.

### @enter-a-random-username — 5 reactions  
`🎉 5`  ·  [link](https://github.com/jellyfin/jellyfin/pull/16062#issuecomment-4199377711)

> Would love to see another merge of master code into PR, because it conflicts after some recent changes to the master. Would be nice as it looks it could be merged soon.
> 
> THX :)

### @Shadowghost — 4 reactions  
`👍 2 · 🚀 2`  ·  [link](https://github.com/jellyfin/jellyfin/pull/16062#issuecomment-4018744680)

> @MarcoCoreDuo if it fixes the same issue, I think it would be the best if you close yours since this one will likely merge conflict otherwise
> 
> @soultaco83 can you please try the most recent commit? The method referenced in the stacktrace does not exist anymore there 😅


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
