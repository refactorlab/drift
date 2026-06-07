# vitejs/vite #16471 — feat: v6 - Environment API

**[View PR on GitHub](https://github.com/vitejs/vite/pull/16471)**

| | |
|---|---|
| **Author** | @patak-cat |
| **Status** | ✅ merged |
| **Opened** | 2024-04-19 |
| **Repo** | curated review-culture seed |
| **Diff** | +8602 / −3878 across 165 files |
| **Engagement** | 84 conversation · 261 inline review comments |

## Top review comments (ranked by reactions)

### @patak-cat — 23 reactions  
`🚀 23`  ·  [link](https://github.com/vitejs/vite/pull/16471#issuecomment-2328350905)

> We discussed in today's Vite team meeting that we should merge this PR so we move further work to main. The changes in this PR are now backward compatible (see ecosystem-ci comment above) and all new APIs are experimental. We can continue refining them during the Vite 6 beta period that we will start now (and even after the stable release, we'll have opportunities for changes if needed until these are stabilized in 6.x).
> Thanks everyone for all the work to get this PR to this point 🎉

### @hi-ogawa — 2 reactions  
`👍 2`  ·  [link](https://github.com/vitejs/vite/pull/16471#issuecomment-2309436060)

> Just in case others are also looking into fixing CI, let me share my note on Remix failure when I checked last time https://github.com/users/hi-ogawa/projects/4/views/1?filterQuery=remix&pane=issue&itemId=72491574.

### @hi-ogawa — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/vitejs/vite/pull/16471#issuecomment-2083934385)

> > After [2866d4f](https://github.com/vitejs/vite/commit/2866d4f2f6cbd184c9d94bc0cdda3c79e790b1aa), we have opt-in for build plugins to be shared, matching the way things work during dev. Individual plugins can set a `sharedDuringBuild: true` to opt-in, ...
> 
> I experimented with `sharedDuringBuild` for unocss on multi environment use cases (namely react server component) https://github.com/hi-ogawa/vite-environment-examples/pull/57/. It's still a minimal proof-of-concept (I picked up some code from original unocss plugin and tailwind v4 plugin), but my impression is that `create(environment)` and `sharedDuringBuild: true` nicely solved the concerns I had with using unocss for RSC. Awesome work!
> 
> It feels really nice to use, so only positive feedback here to confirm if I'm using it right:
> - since `create(environment)` provides `environment.mode: "dev" | "build"`, I use it to split plugins for dev/build as well.
> - since `environment` already has `environment.config, hot, moduleGraph` etc..., I didn't need to access specific environment via `server.environments.(env)` via `configureServer(server)`

### @patak-cat — 1 reactions  
`👍 1`  ·  [link](https://github.com/vitejs/vite/pull/16471#issuecomment-2089087810)

> We discussed with @sapphi-red and he proposed we move away from the `create` hook for bounded plugins, and use a factory (both Anthony and me preferred this form too initially). I actually started using a factory but switched to the `create` hook for the following reasons that I now think are not real blockers:
> - I felt that a function may not be enough in the future, imagine if we want to add more things like enforce or apply that needs to happen before the plugin gets evaluated. I think this may be a no-problem though, as we can first evaluate and then check the flags.
> - I thought that it wasn't easy to support enforce and that it would be needed. For example:
>   ```js
>   function frameworkPlugin() {
>     return [
>       sharedPlugin(), // can have enforce: 'pre'
>       () => isolatedPlugin() // it will stay separated from the prev plugin
>     ]
>   }
>   ```
>   This wasn't that bad at the end, `enforce` works in bounded plugins now
> - `apply` is evaluated before environments are created, so we need to make the last environment param optional or have a new hook. I think it isn't needed though, because we can pass environment as the argument when constructing the isolated plugin and that can be used for filtering
> - I thought that it will be easier to have backward compat with the create hook. Imagine if someone is reading plugins and now PluginOption also can be a function. We could have code broken at runtime or at types level. Maybe it is a price we should pay though.
> - I was also afraid that frameworks could not sniff the plugins to remove these isolated factories at config time an … *[truncated]*

### @patak-cat — 1 reactions  
`👍 1`  ·  [link](https://github.com/vitejs/vite/pull/16471#issuecomment-2307312140)

> The to SASS modern API will be handled in a separate PR. This is only about the Environment API. We'll first merge it, check that we get ecosystem-ci green again and then move to other changes for the major.

### @patak-cat — 1 reactions  
`👍 1`  ·  [link](https://github.com/vitejs/vite/pull/16471#issuecomment-2308366502)

> > I wonder if rewriting `webworker` support as an environment in the future would be the solution.
> 
> The optimizer one could actually be replaced with `optimizeDeps.esbuildOptions.platform`. The `inlineDynamicImports` can be done through `rollupOptions`. We could have also a `replaceProcessEnv` option. I think the only one that is really needed is the browser mapping while resolving. I don't know if there is a way to use `conditions` or other configs to avoid all the branches we had for `targetWeb` in the resolve plugin (that was defined as `!ssr || ssr.target === 'webworker'`). Maybe there is a way to avoid it in the future.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
