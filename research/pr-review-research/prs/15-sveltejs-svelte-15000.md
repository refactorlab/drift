# sveltejs/svelte #15000 — feat: attachments

**[View PR on GitHub](https://github.com/sveltejs/svelte/pull/15000)**

| | |
|---|---|
| **Author** | @Rich-Harris |
| **Status** | ✅ merged |
| **Opened** | 2025-01-13 |
| **Diff** | +669 / −17 across 48 files |
| **Engagement** | 216 conversation comments · 11 inline review comments |

## Why this PR is notable

`{@attach}` — Rich Harris designing in the open. Reviewers debate ergonomics: `kran6a` on HOF composition, `PuruVJ` on dropping `:` for composability, `Ocean-OS` on learner confusion with logic tags.

## 🧠 The lesson for reviewers

> Design-in-the-open review argues **ergonomics, composability and learnability**, not just correctness. The syntax 'bikeshed' is doing real product work.

## How the author framed it (PR description excerpt)

> ## What?
> 
> This PR introduces _attachments_, which are essentially a more flexible and modern version of actions.
> 
> ## Why?
> 
> Actions are neat but they have a number of awkward characteristics and limitations:
> 
> - the syntax is very weird! `<div use:foo={bar}>` implies some sort of equality between `foo` and `bar` but actually means `foo(div, bar)`. There's no way you could figure that out just by looking at it
> - the `foo` in `use:foo` has to be an identifier. You can't, for example, do `use:createFoo()` — it must have been declared elsewhere
> - as a corollary, you can't do 'inline actions'
> - it's not reactive. If `foo` changes, `use:foo={bar}` does not re-run. If `bar` changes, and `foo` returned an `update` method, that method _will_ re-run, but otherwise (including if you use effects, which is how the [docs](https://svelte.dev/docs/svelte/use) recommend you use actions) nothing will happen
> - you can't use them on components
> - you can't spread them, so if you want to add both attributes and behaviours you have to [jump through hoops](https://www.melt-ui.com/docs/introduction)
> 
> We can do much better.
> 
> ## How?
> 
> You can attach an attachment to an element with the `{@attach fn}` tag (which follows the existing convention used by things like `{@html ...}` and `{@render ...}`, where `fn` is a function that takes the element as its sole argument:
> 
> ```svelte
> <div {@attach (node) => console.log(node)}>...</div>
> ```
> 
> This can of course be a named function, or a [function _returned_ from a named function](https://svelte.dev/playground/38ec0c6b48da43cf9805c9e32b58e5fc?version=pr-15000)...
> 
> ```svelte
> <button {@attach tooltip('Hello')}>
>   Hover me
> </button>
> ```
> 
> ...which I'd expect to be …​ *[truncated]*

## Highest-signal comments (ranked by reactions)
> ⚠️ Only the first 100 conversation comments were fetched (API page limit); a later comment could out-rank these.


### @kran6a — 24 reactions  
`👍 6 · 👎 18`  ·  [link](https://github.com/sveltejs/svelte/pull/15000#issuecomment-2588891620)

> Love the proposal and how it simplified actions, specially the handler having a single parameter, which will not only encourage but force writing more composable attachments via HOFs.
> i.e:
> ```ts
> export const debounce = (cb: ()=>void)=>(ms: number)=>(element: HTMLElement)=>{
>     // implementation intentionally left blank
> }
> ```
> ```svelte
> <script lang="ts">
>     const debounced_alert = debounce(()=>alert("You type too slow"));
> </script>
> <textarea {@attach debounced_alert(2000)}></textarea>
> ```
> 
> Personally I would prefer a block syntax rather than the PR one.
> 
> ```svelte
> 
> {#attachment debounce(()=>alert("You type too slow"))(2000), debounce(()=>alert("Server is still waiting for input"))(3000)}
>     <input type="text"/>
>     <textarea></textarea>
> {/attachment}
> ```
> 
> My reasons to prefer a block are:
> 1. It is an already known syntax
> 2. Easily discoverable via intellisense when you type `{#` (to write any other block) and the autocomplete brings up `attachment` as one of the options. I don't think anybody that does not know about attachments is going to discover the PR syntax via intellisense.
> 3. Blocks are easier to read when the block content is a big tree since you can see the opening and closing. This is useful when the element that has the attachment is not an input/button but a clickoutside or a keydown on a whole page section.
> 4. Syntax is cleaner even if you inline the attachment configuration options as otherwise they would be on the same line as 20 tailwind classes, an `id`, `name`, `data-` and `aria-` attributes.
> 5. The `{@something}` syntax already exists and, until now, it could only be used **inside** an element/block, be it declaring a block-scoped constant with `{@co …​ *[truncated]*


### @PuruVJ — 20 reactions  
`👍 11 · 🚀 9`  ·  [link](https://github.com/sveltejs/svelte/pull/15000#issuecomment-2590432366)

> My 2 cents regarding `attach:` instead of `{@attach`: I want the whole `:` thing to go away in svelte. `:` has the olden-days association of not being able to pass it down in the components, which is a mental model that'll always come in the way. We had `on:click`, which was hard to pass down. Event callbacks dropped the `:` and became highly composable. We had class: which couldn't be passed(class could be, but u can't put class: on the components), now they are composable thanks to new clsx-based class. Similarly, I believe replacing use: with {@use } or {@apply } will not just make it more powerful, but also not have the non-composability association to them. There is no point in shoehorning something new into something existing.
> 
> The system needs to be shocked


### @Ocean-OS — 19 reactions  
`👍 19`  ·  [link](https://github.com/sveltejs/svelte/pull/15000#issuecomment-2589025619)

> I like this, my only concern is the similarity in syntax between this and logic tags. It may make new developers think that something like this is valid Svelte:
> ```svelte
> <div {@const ...}>
> ```
> Or may make them try to do something like this:
> ```svelte
> <element>
> {@attach ...}
> </element>
> ```


### @Conduitry — 14 reactions  
`👍 14`  ·  [link](https://github.com/sveltejs/svelte/pull/15000#issuecomment-2588713582)

> The purpose of having a function that returns symbols - rather than using a single symbol - is that it lets you have multiple attachments on a single element/component without them clobbering one another.


---
*Data pulled live from the GitHub REST API. Reaction counts are a snapshot at fetch time.*
