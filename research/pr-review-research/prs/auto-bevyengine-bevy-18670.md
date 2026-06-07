# bevyengine/bevy #18670 — Remote entity reservation v9

**[View PR on GitHub](https://github.com/bevyengine/bevy/pull/18670)**

| | |
|---|---|
| **Author** | @ElliottjPierce |
| **Status** | ✅ merged |
| **Opened** | 2025-04-01 |
| **Repo** | curated review-culture seed |
| **Diff** | +1141 / −63 across 2 files |
| **Engagement** | 30 conversation · 219 inline review comments |

## Top review comments (ranked by reactions)

### @maniwani — 2 reactions  
`👍 1 · 🚀 1`  ·  [link](https://github.com/bevyengine/bevy/pull/18670#issuecomment-2895873297)

> > 1\) Is panicking the best way to handle a removed/despawned component entity? Why not yank the component from all archetypes and continue?
> 
> Eh, I mean, it's not like today's Bevy lets you unregister a component. Configurable cleanup is a feature itself, so I wouldn't tie them together.
> 
> > 2\) Can we make the resource singleton entity different from the component info singleton entity? I don't see why not and that would let us punt `!Send` for later.
> 
> I think the matter of `!Send` data was settled by #18386. Bevy's own first-party plugins are no longer using `!Send` resources, so I think all that's left is to formally deprecate them (which I'm guessing would happen with or following #17485). We had been punting it for too long already lol.
> 
> > 3\) What kind of data do we want to expose via components on the component entity?
> 
> I don't have a list, but low-hanging fruit would be components that represent "implements `Clone`" and such. Then you could write a query that finds all clonable components, all networked components, etc.
> 
> If we spawn entities to represent plugins and link them to their components with `ChildOf`, then you could find out which components come from which plugin.
> 
> Things like that.

### @ElliottjPierce — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/bevyengine/bevy/pull/18670#issuecomment-2894571387)

> > An alternative to this was having the world poll a queue for remote allocation requests during each `flush` (v6). Are the reasons to prefer this PR that it performs better than v6 and that it, unlike v6, never forces remote threads to block?
> 
> Yeah, pretty much. In my experimentation, I found pretty much five ways to do remote reservation:
> 
> 1. Keep a concurrent remote "ready" list that remote reservations can pull from. Top it off on each `flush`. But, that means, we have a longer flush time, sacrifice N entities to always be in the queue, and have the potential to either block and await when the ready list runs dry or allocate a brand new index, which is effectively a memory leak. This is v6, and we block.
> 2. Keep a 2-way channel when other threads request an entity, and those requests are fulfilled. We wouldn't need to fulfill them in `flush`, it could be another `SubApp::update` item. Trouble is, now remote reservations is very block/await heavy. It's not ideal that an asset loader might have to stop or delay reading form disk to await a new frame so it has an entity id. And if we fulfill it more than once per frame, now performance is worse. This was v5.
> 3. Keep a `Vec` and an atomic len in an arc. When reallocating, make a new arc. Hold a `RwLock`  of the most recent vec arc. When the list runs dry, or every once in a while, try to upgrade to a new vec arc. We can cache if there's a new one via an atomic flag. This is effectively a pinned vec, but harder. It does work though; this was v4.
> 4. Fundamentally split the storage of remote and local entities to have differen … *[truncated]*

### @maniwani — 1 reactions  
`👍 1`  ·  [link](https://github.com/bevyengine/bevy/pull/18670#issuecomment-2895178887)

> > I'm not saying I've explored everything, but v9 is the best so far IMO. That said, if anyone has an idea I haven't tried, I'm all ears.
> 
> That's alright. I was asking because I didn't follow all of your discussions and design work leading up to this PR, and I wanted to be sure I had the justification right before approving.

### @NthTensor — 1 reactions  
`😄 1`  ·  [link](https://github.com/bevyengine/bevy/pull/18670#issuecomment-2895266684)

> > I found pretty much five ways to do remote reservation:
> 
> Thanks, this is an amazing writeup!

### @ElliottjPierce — 1 reactions  
`👍 1`  ·  [link](https://github.com/bevyengine/bevy/pull/18670#issuecomment-2993886213)

> @urben1680 Thanks for the review! But to save you time, this pr might not be the solution to remote reservation. It certainly could be, but I'm waiting on #19451 and a decision on entity paging. Depending on what happens there, we might do this pr or something more efficient that those things open up. I'll keep you posted though!

### @Igor-dvr — 1 reactions  
`👍 1`  ·  [link](https://github.com/bevyengine/bevy/pull/18670#issuecomment-3488054850)

> > The worst performance loss is in despawning, which sees a 40-50% regression, but this is right behind the 20-30% improvement to the same benches, so I expect it's actually not much worse compared to 0.17.
> 
> "despawn_world/10000_entities" is actually 6% faster with this PR?  
> "despawn_world/1_entities" and  "despawn_world_recursive/1_entities" is slower but as mentioned there were improvements in the previous pr:
> 
> > This roughly doubles command spawning speed! Despawning also sees a 20-30% improvement. Dummy commands improve by 10-50% (due to not needing an entity flush). Other benchmarks seem to be noise and are negligible. It looks to me like a massive performance win!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
