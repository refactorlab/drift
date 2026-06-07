# nuxt/nuxt #26468 — feat(nuxt): delayed/lazy hydration support

**[View PR on GitHub](https://github.com/nuxt/nuxt/pull/26468)**

| | |
|---|---|
| **Author** | @GalacticHypernova |
| **Status** | ✅ merged |
| **Opened** | 2024-03-24 |
| **Repo importance** | ★60,353 · 5,638 forks · score 87,902 |
| **Diff** | +896 / −15 across 18 files |
| **Engagement** | 40 conversation · 113 inline review comments |

## Top review comments (ranked by reactions)

### @danielroe — 3 reactions  
`👍 3`  ·  [link](https://github.com/nuxt/nuxt/pull/26468#issuecomment-2277883023)

> You can include the changes to `package.json` resolutions from https://github.com/nuxt/nuxt/pull/28285/files#diff-7ae45ad102eab3b6d7e7896acd08c427a9b25b346470d7bc6507b6481575d519R53-R58:
> 
> ```json
>     "vue": "3.5.0-beta.1",
>     "@vue/compiler-core": "3.5.0-beta.1",
>     "@vue/compiler-dom": "3.5.0-beta.1",
>     "@vue/compiler-sfc": "3.5.0-beta.1",
>     "@vue/compiler-ssr": "3.5.0-beta.1",
>     "@vue/shared": "3.5.0-beta.1"
> ```

### @Tofandel — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/nuxt/nuxt/pull/26468#issuecomment-2658767121)

> @danielroe I already started a big cleanup (definitely take this as the regex and everything is made generic) and directive approach in my branch of this PR if you want to take a look, I'm also quite busy right now so didn't have time to finish it up
> https://github.com/Tofandel/nuxt/tree/patch-21

### @danielroe — 3 reactions  
`👍 3`  ·  [link](https://github.com/nuxt/nuxt/pull/26468#issuecomment-2674417389)

> Current TODOs:
> 
> - [ ] ensure we do not preload/prefetch chunks for components that are lazily hydrated
> - [ ] support `#components` importing
> - [x] fix webpack implementation
> - [x] reduce type augmentation - look at directive- or prop-style approach
> - [x] update tests to use locators + avoid hard coding timings

### @harlan-zw — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/nuxt/nuxt/pull/26468#issuecomment-2167701679)

> Nice job overall, the code looks good.
> 
> In terms of the API, I have a couple of issues:
> - End users have no way to configure the visibility and idle triggers which can block them from fine-grain performance tuning. For example, setting more appropriate visibility boundaries or timeouts on the idle.
> - Component names are very tightly coupled to behaviour, if we wanted to add another optimized way to lazy load a component it starts getting complicated (i.e `mouseover`, `click`, etc)
> 
> Personally, I'd like to see a lower-level implementation first that exposes the `defineAsyncComponent` internals on Lazy prefixed components (or a new component prefix). Nuxt can then export an idle / visibility loader that can be configured with types.
> 
> (rough example of what it _could_ look like - not possible at all atm)
> 
> ```vue
> <template>
> 	<LazyFoo :loader="createIdleLoader({ timeout: 3000 })">
> </template>
> ```
> 
> I'd say if someone is reaching for a lazy component then they are already thinking about the best way to load the component, I feel like the extra effort to manually use/configure a loader versus just using `<LazyIdleFoo>` won't be a big deal. IMO the more lazy-loaded components have the worst UX so they should be used sparingly where they are needed.
> 
> I need more time to sit down on this properly and prototype if it's even possible, likely I've missed something.
> 
> It would be great to get your thoughts though.

### @GalacticHypernova — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/nuxt/nuxt/pull/26468#issuecomment-2167942659)

> First things first, thank you so much for the feedback!
> 
> ## TL;DR
> The functionality itself is possible, even right now, just with a few type issues. The exporting, the loader prop, and everything else can already be done. But DX wouldn't be optimal.
> 
> ## In depth
> 
> > * End users have no way to configure the visibility and idle triggers which can block them from fine-grain performance tuning.
> 
> Yea, this is something I had thought about. The issue with this is that these extended lazy components are all based on the regular "sync" component, and in order to even have this extra loader option there would need to be type magic on nuxt's end so that it would be accepted as a prop, and to ensure that it isn't used in non-lazy components as that could cause conflicts which I haven't managed to solve quite yet (maybe you have an idea about them?). Although I agree that having these fine tuned performance opportunities is valuable, at the moment it doesn't seem feasible with full type safety without making a reserved component that would act as a wrapper, which is what most delayed hydration modules/libraries do. The obvious issue with this approach is that it adds **a ton** of boilerplate, so the current implementation extends the base component. 
> 
> That being said, I can add the functionality of it with no issue, like the `create*Loader` and have it used in the components. The main issue would be DX, specifically around type safety, as the prop wouldn't be seen by the IDE. So it is very much possible, just not optimal at the current state of things.
> 
> > * Component names are very tigh … *[truncated]*

### @harlan-zw — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/nuxt/nuxt/pull/26468#issuecomment-2169005341)

> Thanks for your feedback on my comment, it makes sense and they are some good points. The changes look good and I think you have things headed in the right direction.
> 
> One final idea I'll throw in the ring though (sorry :laughing:), what are your thoughts on being able to create the components explicitly? Like how we do with custom Nuxt Links.
> 
> I think this is a nice solution for people who want to avoid the magic of prefixes, it provides full control over the lifecycle (presumably) and easy type support.
> 
> ```ts
> // MyLazyIdleFooComponent
> export default defineLazyComponent({
>   componentName: 'MyLazyIdleFooComponent', // the name of the exported component
>   lazyComponent: 'FooComponent', // the component to wrap
>   loader: createIdleLoader({ // any promise
>     idle: 1200,
>   })
> })
> ```
> 
> ```vue
> <template>
>   <MyLazyIdleComponent />
> </template>
> ```


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
