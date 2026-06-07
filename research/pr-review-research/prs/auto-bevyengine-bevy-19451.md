# bevyengine/bevy #19451 — Improved Entity Lifecycle: remove flushing, support manual spawning and despawning

**[View PR on GitHub](https://github.com/bevyengine/bevy/pull/19451)**

| | |
|---|---|
| **Author** | @ElliottjPierce |
| **Status** | ✅ merged |
| **Opened** | 2025-05-31 |
| **Repo** | curated review-culture seed |
| **Diff** | +1503 / −1281 across 42 files |
| **Engagement** | 12 conversation · 208 inline review comments |

## Top review comments (ranked by reactions)

### @ElliottjPierce — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/bevyengine/bevy/pull/19451#issuecomment-2992111291)

> I wrote this three weeks ago. Looking back, um yes, docs need much improvement. This was a todo item, but probably best to do it in this pr too. I'll take a pass at generally better naming, code comments, and user facing docs, then we can look at the details.
> 
> A few things I just want to clarify my opinion on:
> 
> 1. IMO, we it's very valuable to expose construct/destruct as well as spawn/despawn. I think this should be public for two reasons: For one, it is the migration path over the reserve and flush idea (now, it's allocate and construct). But the bigger reason is that (with entity paging) this would let us do things like have entity ids declared from a server and just construct them on the client world (No Entity Id translation between worlds). With some additional trade-offs, we could even use this to skip entity id translation for the render world! (But more on all that in an entity paging pr.)
> 
> 2. This doesn't introduce any new errors or new ways for an entity to be invalid, not technically. An entity existing but not being constructed is exactly the same error as trying to use a reserved entity before flushing the world. This pr just reframes that existing error from what was `Location::INVALID` etc paired with an "index out of bounds" error to the new `EntityNotConstructedError`. I wouldn't be against hiding that error kind inside `EntityDoesNotExistError`, but I think the distinction would be useful to users, especially if they are making use of construct/destruct directly (ex for multiplayer, consecutive ids for tile map entities, custom entity allocator, etc)
> 
> 3. … *[truncated]*

### @alice-i-cecile — 1 reactions  
`👍 1`  ·  [link](https://github.com/bevyengine/bevy/pull/19451#issuecomment-2992215313)

> > IMO, we it's very valuable to expose construct/destruct as well as spawn/despawn. I think this should be public for two reasons:
> 
> Fully agree!
> 
> > This doesn't introduce any new errors or new ways for an entity to be invalid, not technically. An entity existing but not being constructed is exactly the same error as trying to use a reserved entity before flushing the world. This pr just reframes that existing error from what was Location::INVALID etc paired with an "index out of bounds" error to the new EntityNotConstructedError. I wouldn't be against hiding that error kind inside EntityDoesNotExistError, but I think the distinction would be useful to users, especially if they are making use of construct/destruct directly (ex for multiplayer, consecutive ids for tile map entities, custom entity allocator, etc)
> 
> Upon reviewing the code, I agree :) I'd like to make this type of failure a variant inside of EntityDoesNotExistError, but the information shouldn't be lost.
> 
> > I'm very open to name changes. For a lot of things, the functionality tracks construct/destruct, but the names are still spawn/despawn. Do we want names to be precise (change them to construct) or intuitive to new users (keep them spawn based)?
> 
> I'm pretty happy with the naming balance that you've struck here. We've avoided hitting any of the high traffic APIs, while making the lower level ones as precise as possible. IMO we can reconsider renaming more as users warm up to these ideas.

### @alice-i-cecile — 1 reactions  
`👍 1`  ·  [link](https://github.com/bevyengine/bevy/pull/19451#issuecomment-2994356042)

> > @alice-i-cecile You mentioned some of this stuff should be book content, which makes a lot of sense to me. Where would you like me to draw the line (ex: what should I assume the reader already knows), and how would you like me to proceed (ex: cut the book content from the pr, keep it and later transfer to a book, something else)?
> 
> So, rereading this, I think we should cut pretty much the entire first section of your module docs from this PR. Ultimately, that's book / crate docs content. The scope of these module docs should be "a high-level overview of the entity internals", and your target audience should be "someone who knows how to follow a tutorial and make simple jam games in Bevy already, but who wants to understand how it works under the hood".
> 
> This content is solid and you're both a skilled writer and a domain expert. It could be adapted into either book or crate docs, but that work should be done in a different PR to simplify review and merging :)
> 
> For the new structure, I would propose:
> 
> - what is an [`Entity`], and why is it different from an "entity"
>    -  link out to the module docs very quickly
> - what does this module contain
> - an entity's lifecycle
> - the gory details of [`Entity`] as an identifier (generations and indexes)
> - how are entities stored in the `World` (covering `Entities`) and linking out to some of our component storage docs
> 
> With respect to conceptual entities:
> 
> - this distinction is much clearer when you have spent more words on it!
> - I think the name "conceptual entity" is too abstract and intimidating
> - I think we can use the lens of the e … *[truncated]*

### @ElliottjPierce — 1 reactions  
`👍 1`  ·  [link](https://github.com/bevyengine/bevy/pull/19451#issuecomment-3052487543)

> > I like this new approach!
> 
> Thanks! Me too.
> 
> > What I dislike is that "row" does not fully get rid of the "index" term. Especially the `EntityRow` methods/functions still use "index" here and there as the inner raw value -ish. Elsewhere in `entity/mod.rs` "index" gets mentioned quite a few times too.
> 
> My rational here is two-fold. First, a row *is* an index when there's only one column, like in `Entities`. And second, I didn't want this pr to change naming too much. But point taken. 
> 
> > I would like one replacing the other fully and inner values would be called "raw" instead. I know cart does not like the "row" term at all and I think having everything to be "index" again is also an improvement.
> 
> Truly not opposed to this, but I really don't want to touch naming in this pr. This has been a todo in #18719 for me, but I'm waiting on it especially with Cart and company weighing in. I'm not sure what the final names will end up being, but I agree that it needs a naming pass later.
> 
> > Another duality I stumbled on is that merely allocated entities are also named "null". I would like to decide for one term, not both. I prefer "allocated" because `null` is scary. 😂
> 
> I hear you here. Just to clarify: Null/not-constructed entities are allocated, but so are non-null/constructed entities. The duality/double name is "null" = "not-constructed". The reason I use both is because "not-constructed" is more precise (so I use it in many docs), but "null" is shorter and scarier (so I use it in function names to ward off unwary users). You can leak ids here if you're not careful! And I do my … *[truncated]*

### @ElliottjPierce — 1 reactions  
`👍 1`  ·  [link](https://github.com/bevyengine/bevy/pull/19451#issuecomment-3058308904)

> > Does this fix #19012? I probably cannot test before the weekend.
> 
> @urben1680: Yes and no.
> 
> No, it doesn't fix that. Technically, a freed entity *does* still exist. That is correct. The only requirement for an entity to exist is that the generation is up to date. This is intended behavior. For example, it could allow checking if the entity exists, and then constructing it. (In the particular case of a freed entity, this would cause errors when that entity is allocated, but `resolve_from_row` and `contains` are functioning correctly.)
> 
> Yes, it does add a `contains_constructed` which will return false when a freshly freed and re-resolved row is passed. Both `contains` and `contains_constructed` are useful in different ways. Docs and naming could maybe be improved here to make the uses more obvious.

### @urben1680 — 1 reactions  
`🎉 1`  ·  [link](https://github.com/bevyengine/bevy/pull/19451#issuecomment-3058337465)

> > Yes, it does add a `contains_constructed` which will return false when a freshly freed and re-resolved row is passed. Both `contains` and `contains_constructed` are useful in different ways. Docs and naming could maybe be improved here to make the uses more obvious.
> 
> Hm with two separate methods that distinction becomes more obvious to me which makes me lean more to the "yes" part of your answer.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
