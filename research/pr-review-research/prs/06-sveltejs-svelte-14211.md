# sveltejs/svelte #14211 — feat: add error boundaries

**[View PR on GitHub](https://github.com/sveltejs/svelte/pull/14211)**

| | |
|---|---|
| **Author** | @trueadm |
| **Status** | ✅ merged |
| **Opened** | 2024-11-07 |
| **Diff** | +1,199 / −49 across 78 files |
| **Engagement** | 48 conversation comments · 23 inline review comments |

## Why this PR is notable

Adding error boundaries to Svelte 5. `benbucksch` writes a **structured requirements spec** for what error handling must cover (lifecycle, `$:`, sub-components); `levibassey` offers a concrete **alternative API** (`{#boundary}` / `{#try}` block syntax).

## 🧠 The lesson for reviewers

> The most useful design feedback states **requirements** and proposes **concrete alternative APIs** — not bare opinions. It gives the maintainer something to accept, reject, or merge.

## How the author framed it (PR description excerpt)

> This PR adds support for error boundaries to Svelte. Specifically, it adds `<svelte:boundary>`, which is a special element that can capture errors that occur from within its subtree during client rendering (error boundaries are no-ops during SSR).
> 
> The error boundary will capture all errors that occur in any effects (such as `$effect` and `$effect.pre`) within its subtree, as long as the code is run synchronously (code in an async or `setTimeout` will not be captured). `<svelte:boundary>` can report errors with using `onerror`, this can be a place where the error can be re-thrown to the next boundary:
> 
> > Note: Errors in event handlers are not captured.
> 
> ```svelte
> <script>
>   function throw_error() {
>     throw new Error('test')
>   }
> </script>
> 
> <svelte:boundary onerror={(e) => console.log('error caught')}>
>   {throw_error()}
> </svelte:boundary>
> ```
> 
> In addition, some fallback content can be rendered when an error occurs in a boundary using the `failed` snippet prop:
> 
> ```svelte
> <script>
>   function throw_error() {
>     throw new Error('test')
>   }
> </script>
> 
> <svelte:boundary>
>   {throw_error()}
> 
>   {#snippet failed(error)}
>     <div>An error occurred! {e}</div>
>   {/snippet}
> </svelte:boundary>
> ```
> 
> Additionally, a `reset` function is passed as the second argument to both `onerror` and the `failed` prop:
> 
> ```svelte
> <script>
>   function throw_error() {
>     throw new Error('test')
>   }
> </script>
> 
> <svelte:boundary>
>   {throw_error()}
> 
>   {#snippet failed(error, reset)}
>     <div>An error occurred! {e}</div>
>     <button onclick={reset}>Try again</button>
>   {/snippet}
> </svelte:boundary>
> ```
> 
> Feel free to [play around with them on the playground](https://svelte.dev/playground/9c94abb1a19946a3b727c …​ *[truncated]*

## Highest-signal comments (ranked by reactions)

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
> So, while adding try/catch to every statement is theoretically possible, it's not feasible in practice.
> The same applies to event handlers.
> 
> ## Impact
> 
> What I have seen people do …​ *[truncated]*


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


---
*Data pulled live from the GitHub REST API. Reaction counts are a snapshot at fetch time.*
