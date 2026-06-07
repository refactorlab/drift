# vitejs/vite #16129 — feat: environment api

**[View PR on GitHub](https://github.com/vitejs/vite/pull/16129)**

| | |
|---|---|
| **Author** | @patak-cat |
| **Status** | ✅ merged |
| **Opened** | 2024-03-10 |
| **Repo** | curated review-culture seed |
| **Diff** | +5730 / −2542 across 121 files |
| **Engagement** | 24 conversation · 33 inline review comments |

## Top review comments (ranked by reactions)

### @patak-cat — 1 reactions  
`👍 1`  ·  [link](https://github.com/vitejs/vite/pull/16129#issuecomment-2004282015)

> We discussed about the [node -> ssr rename](https://github.com/vitejs/vite/commit/e03bac8ba4197712b304fb995c92356de3edea63) today with Vladimir and decided that we are moving forward with it. I think that we should also move from `browser` to `client` to match other parts of the Vite docs/API (and also it would play well with enabling non-browser use cases in the future, or at least not going against them). We didn't decide that move yet.
> 
> We also discussed moving from an environments Map to an environments array to have a clear order and avoid issues with handling the `name` in the config.

### @patak-cat — 1 reactions  
`👍 1`  ·  [link](https://github.com/vitejs/vite/pull/16129#issuecomment-2034440886)

> This commit took me quite some time to figure out: https://github.com/vitejs/vite/pull/16129/commits/dd6332e4c555171251b2521b1c0b671c8ead9ae0
> 
> `config.createResolver()` can override resolve options like `mainFields` or `conditions`, but it still needs to know the default environment options for the client and ssr. It internally creates a `pluginContainer` with an Alias and Resolve plugins. These two plugins can't use `this.environment` normally because `config.createResolver()` doesn't have access to the environment instances and this is a public API so we need to keep it working for backward compat.
> The commit deprecates it, and recommends using a new `createIdResolver(environment)` function that I still need to push, and that we will start using internally to simplify our code. The Alias and Resolve plugin will remain with this backward compat layer for a while.
> This should unlock the deps optimizer PR, and work on `external/noExternal`

### @hi-ogawa — 1 reactions  
`🚀 1`  ·  [link](https://github.com/vitejs/vite/pull/16129#issuecomment-2040889394)

> > @hi-ogawa external/noExternal has now been implemented too, would you check that your POC is working without your hack?
> 
> Awesome! I tested `vite@6.0.0-alpha.0` and it's working without patch https://github.com/hi-ogawa/vite-environment-examples/pull/9

### @patak-cat — 0 reactions  
`—`  ·  [link](https://github.com/vitejs/vite/pull/16129#issuecomment-1998545800)

> The PR now implements several ideas that we have discussed but we haven't yet decided will be in the final form of the Environment API. I think that it is important to implement these so we can discuss with a proof of concept in our hands. I'll not be updating the docs PR with all of these until getting more validation from others. The config overrides should be ok to follow from the code.
> 
> Checkout changes to [config.ts](https://github.com/vitejs/vite/pull/16129/files#diff-11e17761d4ecfee8f8fde15c6d79b7bc0260176396a30dfd8e6f6bbaf5af4745R128). Most of these are aligning dev and build.
> 
> Note: `DevEnvironment` is currently called `ModuleExecutionEnvironment`. @sheremet-va ok to rename it now that we use dev in other related type and options names?
> 
> | dev      | build     |
> | -------- | --------- |
> | `server` | `builder` |
> | `createViteServer` | `createViteBuilder` |
> | `DevEnvironment` | `BuildEnvironment` | 
> | `dev` options | `build` options |
> | `configureDevEnvironments` | `configureBuildEnvironments` |
> 
> `server` options should only be about the shared server config, `dev` options about what can be overriden per environment. For example `server.warmup` -> `dev.warmup`
> 
> See [`builder`](https://github.com/vitejs/vite/pull/16129/files#diff-aa53520bfd53e6c24220c44494457cc66370fd2bee513c15f9be7eb537a363e7R1305) here. Running `vite build --all` builds all environment. Order and parallelisation can be controlled with `builder.runBuildTasks`
> 
> There is also a `server.runHmrTasks` that would let users decide how HMR propagation should be ordered or parallelised for dev environments. … *[truncated]*

### @patak-cat — 0 reactions  
`—`  ·  [link](https://github.com/vitejs/vite/pull/16129#issuecomment-1998987614)

> Another idea to have the Environment creation in the config (or with the JS API), and not through plugins could be to have them as part of `EnvironmentConfig`:
> ```js
> {
>   environments: {
>     rsc: {
>       build: {
>         outDir: '/dist/rsc/` 
>         create: (builder) => new WorkerdBuildEnvironment(builder),
>       },
>       dev: {
>         create: (server) => new NodeBuildEnvironment(server)
>       }
>     }
>   }
> }
> ```
> So you define the overrides and how to create it in the same place. And there is a clear central place to also define the build and dev side of each environment. Here, `environments` in the config will be an even higher concept, like @antfu proposed. The issue with this one is that it isn't easy to see how to override in the config file `resolve.conditions` in a way that works differently for dev and build. And if different Environment runtimes are used, it may be needed. I imagine it is ok, most of the time it will be the same environment (both node, both workerd) to try to have dev as close as possible build. And if they are diff, fine grained config should be done inside by the `WorkerdBuildEnvironment`.
> 
> Note: we discussed renaming `environment.id` to `environment.name`. Removing `environment.type` as knowing the type of runtime shouldn't be encouraged. And we may then rename `environment.mode` to `environment.type: 'dev' | 'build' (| 'preview' ?)`. This isn't reflected in the PR.

### @sheremet-va — 0 reactions  
`—`  ·  [link](https://github.com/vitejs/vite/pull/16129#issuecomment-1999305712)

> > ok to rename it now that we use dev in other related type and options names?
> 
> I am fine with that.
> 
> > About the `configureBuildEnvironments` hook, it forces us to resolve the plugin pipeline to be able to call it, and then we don't use these plugins or resolved config as each build needs a new resolution (with new plugins). I think a hook to configure environments may not be the right abstraction. Maybe we should directly have this in the config:
> 
> I don't see how this solves the problem though. We still need to resolve the config - environments can be added by plugins in a `config` hook. I don't think there is a way around that unless we are introducing a separate config.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
