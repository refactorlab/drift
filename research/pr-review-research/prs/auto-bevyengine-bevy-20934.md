# bevyengine/bevy #20934 — Store Resources as components on singleton entities

**[View PR on GitHub](https://github.com/bevyengine/bevy/pull/20934)**

| | |
|---|---|
| **Author** | @Trashtalk217 |
| **Status** | ✅ merged |
| **Opened** | 2025-09-08 |
| **Repo** | curated review-culture seed |
| **Diff** | +1675 / −1092 across 52 files |
| **Engagement** | 13 conversation · 164 inline review comments |

## Top review comments (ranked by reactions)

### @chescock — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/bevyengine/bevy/pull/20934#issuecomment-3482562826)

> For `AnimationEntityMut`: If we allow `IsResource` entities in that query, and then add the three resources used by the `animate_targets` system to the "except" list, is that enough to support animating resources?  Is it useful to animate resources?  
> 
> If generic code like that winds up being useful for resources without any other changes, that seems like an argument in favor of allowing `IsResource` entities by default!

### @Trashtalk217 — 1 reactions  
`👍 1`  ·  [link](https://github.com/bevyengine/bevy/pull/20934#issuecomment-3478446229)

> # Having `IsResource` as a default query filter
> 
> There has been much discussion with regards to `IsResource` being a default query filter (DFQ) on Discord. And after a request by cart, I decided to look at the impact of unmaking `IsResource` a DFQ. As a reminder: If `B` is a default query filter, then `Without<B>` is automatically added to a query. So `Query<&A>` quietly becomes `Query<&A, Without<B>>`.
> 
> ## `IsResource` is a DFQ
> 
> If `IsResource` is registered as a DFQ, virtually nothing changes compared to the status quo. `Query<Entity>` returns the same number of entities before and after transitioning to resource-as-components. The benefits of transparency are obvious, since we're not hiding anything. This is why we are mostly focused on the case where `IsResource` is not a DFQ.
> 
> ## `IsResource` is not a DFQ
> 
> This has the largest effect on *broad* queries. Broad queries access *all* entities, so if a system contains a broad query and also a resource, this creates a conflict that wasn't there before resources-as-components.
> 
> Examples of broad queries include:
> - `Query<()>`
> - `Query<Entity>`
> - `Query<EntityMut>`
> - `Query<EntityRef>`
> - `Query<EntityMutExcept>`
> - `Query<EntityRefExcept>`
> - `Query<Option<&A>>`
> 
> The first two are not really big deal. Since both access no components, they don't conflict with a `Res<R>` or a `ResMut<R>` in a system. The only thing that changes is the number of entities that they return, which - in tests in particular - can cause problems. See also #20207, #20248, #21685, and the last two commits for my work on this.
> 
> The last 5 queries can cause … *[truncated]*

### @SkiFire13 — 0 reactions  
`—`  ·  [link](https://github.com/bevyengine/bevy/pull/20934#issuecomment-3324756887)

> The access control is currently not enough since `Query<&mut MyResource, With<Internal>>` and `ResMut<MyResource>` don't conflict but still provide mutable access to the same data. The following test should not reach the `unreachable`:
> 
> ```rs
> #[test]
> fn resource_conflict() {
>     use crate::prelude::*;
> 
>     #[derive(Resource)]
>     struct Foo;
> 
>     let mut world = World::default();
> 
>     world.insert_resource(Foo);
> 
>     fn system(mut q: Query<&mut Foo, With<Internal>>, r: ResMut<Foo>) {
>         let _foo1 = q.single_mut().unwrap();
>         let _foo2 = r;
> 
>         unreachable!("This should not be possible")
>     }
> 
>     world.run_system_once(system);
> }
> ```

### @Igor-dvr — 0 reactions  
`—`  ·  [link](https://github.com/bevyengine/bevy/pull/20934#issuecomment-3324914457)

> > How big the difference between singleton components and regular components is going to be? If resources are singleton components should we still call them resources? Maybe Singleton short for singleton component. Will this be clearer to users and imply that singleton component can be treated similarly as component? 
> 
> IsResource > IsSingleton

### @cactusdualcore — 0 reactions  
`—`  ·  [link](https://github.com/bevyengine/bevy/pull/20934#issuecomment-3353822531)

> Couldn't these types implement a `UniqueComponent` supertrait of `Component` instead of having an `IsResource`? I think this is how immutable Components work, right?
> 
> Edit: seems I am a bit behind on how immutable components work, but I think the implementation might still be interesting for uniqueness.

### @alice-i-cecile — 0 reactions  
`—`  ·  [link](https://github.com/bevyengine/bevy/pull/20934#issuecomment-3478456619)

> `Query<Option<&A>>` is definitely the most concerning of these, but it's very rare for it to be used on its own without any other qualifying terms.
> 
> That said, (iteration over) broad queries should never occur in engine / library code outside of very niche applications like networking. These have a linear performance cost with the total number of entities, regardless of the type of entity, and should be refactored whenever possible.
> 
> Evaluation of the current cases:
> 
> 1. Scenes: justified use, scenes are inherently fine.
> 2. Animation: we could trivially extend `AnimationEntityMut` to exclude resource entities and avoid breakage for end users as well.
> 3. Input Focus: the query in question appears to be used for point queries only: won't have any linear performance consequences.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
