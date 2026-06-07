# microsoft/PowerToys #41961 — CmdPal: Make Bookmarks Great and Fast Again

**[View PR on GitHub](https://github.com/microsoft/PowerToys/pull/41961)**

| | |
|---|---|
| **Author** | @jiripolasek |
| **Status** | ✅ merged |
| **Opened** | 2025-09-23 |
| **Repo importance** | ★133,794 · 8,036 forks · score 170,937 |
| **Diff** | +6098 / −898 across 70 files |
| **Engagement** | 29 conversation · 67 inline review comments |

## Top review comments (ranked by reactions)

### @jiripolasek — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/PowerToys/pull/41961#issuecomment-3329071419)

> @zadjii-msft Can this be reviewed before the lock, or should I focus solely on addressing the spaces in the bookmarks?

### @jiripolasek — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/PowerToys/pull/41961#issuecomment-3329792940)

> I need to modify how `Unknown` kind bookmarks are handled, as their presentation and actual launching are inconsistent: 
> Test case:
> 1. Create a folder on the Desktop named `Squirrel`
> 2. Create a new bookmark with address `Squirrel`
> 3. Observe that the bookmark is identified as "Squirrel folder" on the desktop (similar to Explorer behavior) but cannot be opened (similar to run behavior).
> 
> If classification fails, only raw name and address should be used to represent the bookmark and no other magic should be applied.

### @jiripolasek — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/PowerToys/pull/41961#issuecomment-3356027041)

> > okay 64/68 but alas, I did not finish the rest before breakfast.
> > 
> > Pretty much everything in here only rises to the level of non-blocking nits and things to put into a (yet to be created) bookmarks megathread.
> 
> What’s the time window for fixing those? Would 3–4 hours from now be acceptable?
> 
> > bookmarks megathread
> 
> ♥️

### @zadjii-msft — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/PowerToys/pull/41961#issuecomment-3356531298)

> > What’s the time window for fixing those? Would 3–4 hours from now be acceptable?
> 
> Oh for sure. I'm gonna finish reviewing here, then I basically have meetings all day, but that'll give CI time to ~fail a couple times~ run so we can merge before I log off (~UTC 22:00)

### @jiripolasek — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/PowerToys/pull/41961#issuecomment-3357593079)

> ~Holds the machines! Another push is on the way... somewhere~ squirrel damn lags

### @jiripolasek — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/PowerToys/pull/41961#issuecomment-3358384512)

> <img width="288" height="422" alt="image" src="https://github.com/user-attachments/assets/6247080e-9ba1-4d21-8ad8-5f0c49614146" />


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
