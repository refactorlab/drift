# sveltejs/svelte #14211 — feat: add error boundaries

**[View PR on GitHub](https://github.com/sveltejs/svelte/pull/14211)**

| | |
|---|---|
| **Author** | @trueadm |
| **Status** | ✅ merged |
| **Opened** | 2024-11-07 |
| **Repo** | curated review-culture seed |
| **Diff** | +1199 / −49 across 78 files |
| **Engagement** | 48 conversation · 23 inline review comments |

## Top review comments (ranked by reactions)

### @benbucksch — 10 reactions  
`👍 10`  ·  [link](https://github.com/sveltejs/svelte/pull/14211#issuecomment-2479715712)

> ## Requirement
> 
> The component needs to handle its own errors, with a single error handler, e.g. showing an inline error, including all `$:` statements, event handlers, all errors in sub-components, and any other error/exception sources. If this error handler is added, the component must not throw errors up, in any case. Essentially, a try/catch or error handler for the entire component.
> 
> Given that many components will want to catch their own errors, the syntax should be simple and straight-forward, without a lot of code footprint. (Esp. given that one of the primary advantages of Svelte over React is the comfortable and natural syntax.)
> 
> ## Non-solutions
> * Wrapping each component with another, just to catch errors
> * Adding try/catch to every single `$:` statement and event handler
> * Other hacks
> 
> ## try/catch
> I am aware that I can add a try/catch to every single `$:` statement in the component, and every single event handler. However,
> a) The `$:` statements are designed to be simple one-line statements. Requiring every single one of them to have a try/catch is not realistic.
> b) None of the tutorials use try/catch in the `$:` statements
> c) It's not commonly done. None of the other developers in the ca. 100-man Svelte-based project used try/catch in `$:` statements. I was the only developer who advocated that and did that with any regularity. This is common: If you ask ChatGPT (which reflects common code in github and stackoverflow), you'd see the same: people don't catch errors in `$:` statements.
> So, while adding try/catch to every statement is theoretically possible, it's … *[truncated]*

### @benbucksch — 7 reactions  
`👍 7`  ·  [link](https://github.com/sveltejs/svelte/pull/14211#issuecomment-2479743948)

> Proposal 1: I see what you mean, but here's my logic or idea:
> 
> 1. With this PR, I could manually wrap all my components with another component that only catches errors, and calls a function, and that function could be a prop from the lower component. Functionally, I would get what I need. It's just so cumbersome to be impossible in practice to do for all components.
> 3. On top of this PR, there could be a feature where, if I a component adds an error handler, a wrapper component is *generated* which does what I would do manually in point 1. So, the error handler is basically a macro or boilerplate generator which generates the code from point 1.
> 4. If the code from point 2 is in the runtime, there are most likely ways to optimize the code generated for this specific use case, and instead create some code that short circuits some parts and is therefore more efficient.
> 
> > Components ... in Svelte 5, they're just functions
> 
> Suggestion 2: Can you wrap that (component) function in a try/catch, where the catch calls a function of the component? (The answer is probably no, because it's the obvious solution.)

### @levibassey — 6 reactions  
`👍 6`  ·  [link](https://github.com/sveltejs/svelte/pull/14211#issuecomment-2463109960)

> Was kinda expecting the api to look like this
> ```svelte
> {#boundary}
>     ...
> {:else e}
>     <div>An error occurred! {e}</div>
> {/boundary}
> ```
> 
> Maybe even
> ```svelte
> {#try}
>     ...
> {:catch e}
>     <div>An error occurred! {e}</div>
> {/try}
> ```
> 
> Aren't error boundaries more like, control flow?

### @trueadm — 5 reactions  
`👍 5`  ·  [link](https://github.com/sveltejs/svelte/pull/14211#issuecomment-2463114248)

> > Was kinda expecting the api to look like this
> > 
> > ```svelte
> > {#boundary}
> >     ...
> > {:else}
> >     ...
> > {/boundary}
> > ```
> > 
> > Maybe even
> > 
> > ```svelte
> > {#try}
> >     ...
> > {:catch}
> >     ...
> > {/try}
> > ```
> > 
> > Aren't error boundaries more like control flow?
> 
> What if you want to re-throw an error, or log an error to sentry? What if you want to render the error message somewhere else? We explored this API and it has too many drawbacks. Not to mention, `<svelte:boundary>` can support other usages in the future other than just capturing errors.

### @dummdidumm — 4 reactions  
`👍 4`  ·  [link](https://github.com/sveltejs/svelte/pull/14211#issuecomment-2480507479)

> Wrapping every component with an error boundary is an anti pattern - what is even supposed to happen once an error is thrown? You probably want to decide that specifically for each component, so it doesn't scale to wrap everything. 
> Error boundaries are meant as - like the name says - boundaries for specific parts of your app where you can have a clear fallback (and possibly retry) behavior.

### @trueadm — 3 reactions  
`👍 3`  ·  [link](https://github.com/sveltejs/svelte/pull/14211#issuecomment-2463160575)

> > What if you don't want to show anything from inside the boundary if an error occurs, and instead use a fallback?
> > 
> > Right now it seems that whatever has a chance to get rendered / added to the dom, stays in, which could result in a broken state. I added an `{#if}` with a reactive `error` var but it doesn't seem to matter.
> > 
> > [Demo from a commit in this pr](https://svelte.dev/playground/hello-world?version=commit-f683ce2c25c1ef35f87e863d687760fe475112b5#H4sIAAAAAAAAE3WS3U7DMAyFX8UEpLVStUpcdmklQLwBdxShrnNpROdUicuYorw7Slp-NuAyx4792cdOULNHUYh7Y7SBWz3RrjEKLYhMdGpAK4pHJ_g4hqQgiOzzy804ru0bDhy0bWPxL73VxEhsRSGkbY0auaqpZrUftWG40_tRExJDZ_QeVuv8S1lKrDY1hQ8DMmBkLOHKcsOYpJuaZP5dlGR_Xf2aw_b6AAuFzPvrmOkuLalxRIauUQPuklg6A4MWOfWhoewN5JFV7tRbdUNLe922kzG4uwAXBS_zEI-J24lZE2hqB9W-li6W89WDOULz0iiS-ZxR1eTyhcBH8nnYYjtzH8HNXB40xS6lSzCFslqaQgm4CVNZPeB60C8JphvvI4W7VB1czGzhDSC_1zxP5HLV-bi807ZVTSITjO8sCjYT-uwf689dOj2AP6L_nEE3UctKE3Bv9OE5QicpuBCrOYpAeIDoarL6kbUK7tfsz07AnRSadxvseeiV_bwCUHY-t3POLyfpfA9P_gNTbsODKQMAAA==)
> 
> Looks like a bug, looking into that now.
> 
> Update:[fixed](https://svelte.dev/playground/hello-world?version=commit-10897ac38c3c2828558329b345368372bcf2412d#H4sIAAAAAAAAE3WS3U7DMAyFX8UEpLVStUpcdmklQLwBdxShrnNpROdUicuYorw7Slp-NuAyx4792cdOULNHUYh7Y7SBWz3RrjEKLYhMdGpAK4pHJ_g4hqQgiOzzy804ru0bDhy0bWPxL73VxEhsRSGkbY0auaqpZrUftWG40_tRExJDZ_QeVuv8S1lKrDY1hQ8DMmBkLOHKcsOYpJuaZP5dlGR_Xf2aw_b6AAuFzPvrmOkuLalxRIauUQPuklg6A4MWOfWhoewN5JFV7tRbdUNLe922kzG4uwAXBS_zEI-J24lZE2hqB9W-li6W89WDOULz0iiS-ZxR1eTyhcBH8nnYYjtzH8HNXB40xS6lSzCFslqaQgm4CVNZPeB60C8JphvvI4W7VB1czGzhDSC_1zxP5HLV-bi807ZVTSITjO8sCjYT-uw … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
