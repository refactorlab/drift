# nodejs/node #52190 — cli: implement `node --run <script-in-package-json>`

**[View PR on GitHub](https://github.com/nodejs/node/pull/52190)**

| | |
|---|---|
| **Author** | @anonrig |
| **Status** | ✅ merged |
| **Opened** | 2024-03-22 |
| **Repo** | curated review-culture seed |
| **Diff** | +352 / −0 across 20 files |
| **Engagement** | 104 conversation · 100 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @wraithgar — 32 reactions  
`👍 22 · ❤️ 3 · 😕 7`  ·  [link](https://github.com/nodejs/node/pull/52190#issuecomment-2019307592)

> > @mylesborins why is this so slow in package managers such as npm? Is it a technical challenge or just priorities?
> 
> It is a little bit of both.  At the end of the day 200ms is not slow, honestly.  We're not invoking a bash script here, we are loading up an entire environment with configs to parse and side effects to manage.  Consumers have come to rely on a lot of those side effects, to the point [where even if we remove ones that are seemingly unrelated to npm itself we break workflows](https://github.com/npm/cli/issues/5852).
> 
> The reason npm exports any configs that are not the defaults is so that npm scripts that call npm are aware of any cli parameters that got set during the initial `npm run`.  I'm sure that seems unnecessary if you aren't calling npm inside your script but a lot of folks rely on this
> 
> With that in mind some of the specifics that slow things down are setting process.title, and the fact that npm can not (generally) utilize lazy loading (i.e. requiring a module only when it is needed).
> 
> [Setting process.title](https://github.com/npm/cli/blob/1114a12f2b4691d403d0863d4dca44f25580f57d/lib/cli-entry.js#L5-L7) is a security measure that, to my knowledge has always been part of npm.  The stated purpose has been to prevent leaking config from cli flags to consuming scripts and other processe.  It is unlikely we will remove this security constraint.
> 
> npm can not generally take advantage of lazy loading because it has to be able to install over the top of itself.  Part of installation is the removal of the old code, and if a `require` statement happens after tha … *[truncated]*

### @fabiospampinato — 22 reactions  
`👍 15 · ❤️ 4 · 🚀 3`  ·  [link](https://github.com/nodejs/node/pull/52190#issuecomment-2021738482)

> > The question is if the value is sufficient in regards to the extra complexity it adds both to users and maintainers. Do our users care if it takes 200ms or 40ms?
> 
> I see a similar sentiment in multiple comments to this PR. If I can try to defend the perf improvement: one of the explicit goals for Bun is making things about as fast as they can be, and people seem to love it for that also, if Node was as fast or faster than Bun at everything I think we can all imagine that many fewer people would have been interested in switching to something else, people do care about performance.
> 
> In general the JS ecosystem as a whole has a bit of a stigma of producing "good enough" products, at best, and that happens because some developers just don't care about writing efficient software, or they don't have the time or knowledge or resources to implement what's needed to make something efficient. 
> 
> As a JS developer myself it pains me to know that since I'm using node+npm I don't have immediate access to a way to run package.json scripts that has anywhere near the performance of what both Bun and Deno can do. And I don't think it's a coincidence, nor a mistake, that both Bun and Deno provide this functionality directly, it's a pretty important common feature, they want to delight their users, they had to take matters into their own hands to make that happen.
> 
> As seen in #46534 the default way to run a script in the node+npm stack, `npm run`, is roughly 10x slower than necessary, and `npm run` is a very common command to execute, I wouldn't be surprised if worldwide it gets executed hund … *[truncated]*

### @MylesBorins — 11 reactions  
`👍 11`  ·  [link](https://github.com/nodejs/node/pull/52190#issuecomment-2020576431)

> I think the project needs to seriously consider if it wants to take on this functionality and the benefit it provides. I want to copy / paste my comment from @joyeecheung's attempt 
> 
> https://github.com/nodejs/node/pull/46534#issuecomment-1439018735
> 
> > I have mixed feelings about this. On one hand a streamlined way of running scripts that is "very fast" and "streamlined" seems beneficial... but having "yet another way" of doing this seems rife with error + confusion.
> > 
> > I think it would be useful to ensure everyone is on the same page about the use case of node --run and what type of developer would actually be using it.
> >
> > My intuition is that there is very few people using Node.js without a package manager, and even fewer who need to be running scripts for their projects that have 0 external dependencies. How many people do we know hand writing a package.json and then NOT using a package manager to install it. This scenario seems a bit contrived to me in all honesty. If someone is then using a package manager to install their dependencies they can use the same package manager to install a script
> > 
> > What I have heard folks complain about is the speed of npm run and how many things are getting loaded just to run some scripts. I've also heard folks complain about not being able to specify the shell used to run scripts and wanting more flexibility.
> > 
> > Script running gets quite complicated across the various package managers for reasons mentioned above including:
> > 
> > * magic env vars to make running dep bins simpler
> > * how argument passing is done
> > * lifecycle scripts … *[truncated]*

### @timfish — 10 reactions  
`👍 9 · 👀 1`  ·  [link](https://github.com/nodejs/node/pull/52190#issuecomment-2016105445)

> That's a lot faster!
> 
> - Without adding `node_modules/.bin` to the `PATH` this isn't going to be very useful
>   - If I have playwright as a dependency I would want `"playwright test"` to work
> - It would be useful if it could pass additional arguments as it means you don't need a tool installed globally to run it with additional arguments
>   - `npm run` requires `--` before extra arguments but `yarn run` doesn't which is shorter
> - Both npm/yarn pass a load of `npm_` [environment variables](https://github.com/npm/cli/blob/1114a12f2b4691d403d0863d4dca44f25580f57d/docs/lib/content/using-npm/scripts.md#environment) to scripts. I've mostly only seen these in install scripts so it might not be too much of an issue
> - Both npm/yarn run support [pre and post](https://github.com/npm/cli/blob/1114a12f2b4691d403d0863d4dca44f25580f57d/docs/lib/content/using-npm/scripts.md#pre--post-scripts) scripts which are common.

### @tniessen — 10 reactions  
`👍 10`  ·  [link](https://github.com/nodejs/node/pull/52190#issuecomment-2016655308)

> I don't have a strong opinion on this, but I do share some concerns:
> 
> * npm does set many environment variables for scripts, and this already causes headaches when running through yarn, for example. It seems that `node run` might further complicate things by adding yet another implementation.
> * scripts are often spawned recursively, e.g., `npm run foo && npm run bat`. It doesn't matter much how fast `node run` is if recursive calls don't use it.

### @MylesBorins — 9 reactions  
`👍 8 · ❤️ 1`  ·  [link](https://github.com/nodejs/node/pull/52190#issuecomment-2018649786)

> I feel like this feature should launch as experimental, even if Semver Major. 
> 
> The only "semver breaking" change here is stepping on `run` as a keyword... but we should afford ourselves the flexibility of making large changes to the inner workings of this functionality.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
