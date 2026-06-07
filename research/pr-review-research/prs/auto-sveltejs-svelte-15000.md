# sveltejs/svelte #15000 — feat: attachments

**[View PR on GitHub](https://github.com/sveltejs/svelte/pull/15000)**

| | |
|---|---|
| **Author** | @Rich-Harris |
| **Status** | ✅ merged |
| **Opened** | 2025-01-13 |
| **Repo** | curated review-culture seed |
| **Diff** | +669 / −17 across 48 files |
| **Engagement** | 216 conversation · 11 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

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
> 5. The `{@something}` syntax already exists and, until now, i … *[truncated]*

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

### @Rich-Harris — 14 reactions  
`👍 14`  ·  [link](https://github.com/sveltejs/svelte/pull/15000#issuecomment-2588837336)

> @huntabyte 
> 
> > Would something like this work as well?
> 
> [try it and see :)](https://svelte.dev/playground/hello-world?version=pr-15000#H4sIAAAAAAAAE5VRTW-DMAz9K1YuAamjd0aRetu0446lUtNgVrQQo8TdViH--xKoxqr1spv1_L5kD8KqDkUuntAYgk9ypoYE65axTsVKNK1BL_LdIPjSR14EAn5Vbfs-8x9oOGJH5fEerskyWg42ovDatT2Xla247XpyDANoh4pxy6z0qQvEF7zACI2jDuRsslY_Sy8fgzjIg6tn8HxuGtjAEKEAGuV9DlITmYfjmZmsXM0rstq0-j2HJIVNCVFOBjNDb4mcNljL9Mrd3amUpPugtVTjH_3hGVQHZBGWnoc0Wo03ZYlP6F5vG_8zSk5Ryk5Wv-LkHFfZYr2c2BbzCWDIsmy61DiNS4-xPMW_F-uZWIZvMX6xyNmdcdyP30nmDAAfAgAA)
> 
> > I wonder if it would be more flexible for composition if the syntax can work with named props.
> 
> You're just describing normal props! The `{@attach ...}` keyword is only useful when it's anonymous.
> 
> ```svelte
> <MyComponent {@attach anonymousAttachment} named={namedAttachment} />
> ```
> 
> ```svelte
> <script>
>   let { named, ...props } = $props();
> </script>
> 
> <div {@attach named} {...props} />
> ```
> 
> > One of the advantages of the special syntax of actions was the fact that it generated shakable tree code
> 
> I don't follow? The only treeshaking that happens, happens in SSR mode — i.e. `<div use:foo>` doesn't result in `foo` being called on the server. That remains true for attachments. The additional runtime code required to support attachments is negligible.
> 
> > If I understand correctly, it is not possible to extract an attachment from the props
> 
> It's deliberate that if you use `{...stuff}` that attachments will be included in that. If you really want to remove them it's perfectly possible, it's just an object with symbols. Create a derived that filters the symbols … *[truncated]*

### @huntabyte — 12 reactions  
`👍 12`  ·  [link](https://github.com/sveltejs/svelte/pull/15000#issuecomment-2591622041)

> @Rich-Harris my concern with the current approach is that it creates a significant incentive mismatch that'll push everyone toward anonymous attachments when named ones (especially when coming from libraries) are clearly better for maintainability and flexibility:
> 
> ```ts
> // named
> const namedBaseAttachments = { hover: node => {}, focus: node => {} }
> const namedDragAttachments = { drag: node => {}, dropzone: node => {} }
> const namedTooltipAttachments = { tooltip: node => {}, aria: node => {} }
> 
> // anon
> const anonBaseAttachments = { [Symbol()]: node => {}, [Symbol()]: node => {} }
> const anonDragAttachments = { [Symbol()]: node => {}, [Symbol()]: node => {} }
> const anonTooltipAttachments = { [Symbol()]: node => {}, [Symbol(): node => {} }
> ```
> 
> ```ts
> // Mixed props and attachments 
> const namedButtonProps = {
>   onclick: () => {}, // prop
>   class: 'btn', // prop
>   ...namedBasedAttachments,
>   ...namedDragAttachments,
>   ...namedTooltipAttachments
> }
> 
> const anonButtonProps = {
>   onclick: () => {}, // prop
>   class: 'btn', // prop
>   ...anonBasedAttachments,
>   ...anonDragAttachments,
>   ...anonTooltipAttachments
> }
> ```
> ```ts
> // Anonymous just works™️
> <button {...anonButtonProps} />
> 
> // Named requires explicit ceremony + knowledge of what's an attachment
> <button 
>   {...namedButtonProps} // Doesn't work for attachments
>   {@attach hover} 
>   {@attach tooltip}
>   // Hope we didn't miss any attachments in buttonProps and we also just spread some functions into our HTML
> />
> 
> // Even with {...attachments}, you need to think about putting all the attachments into a single key of the
> // object so they … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
