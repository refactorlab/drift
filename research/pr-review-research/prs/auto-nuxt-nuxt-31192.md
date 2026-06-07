# nuxt/nuxt #31192 — feat(nuxt): support lazy hydration macros

**[View PR on GitHub](https://github.com/nuxt/nuxt/pull/31192)**

| | |
|---|---|
| **Author** | @Mini-ghost |
| **Status** | ✅ merged |
| **Opened** | 2025-03-03 |
| **Repo importance** | ★60,353 · 5,638 forks · score 87,902 |
| **Diff** | +847 / −136 across 17 files |
| **Engagement** | 15 conversation · 31 inline review comments |

## Top review comments (ranked by reactions)

### @danielroe — 2 reactions  
`👍 2`  ·  [link](https://github.com/nuxt/nuxt/pull/31192#issuecomment-2708225788)

> Yes, we would have to be very clear users would have to pass a string literal. On the other hand, we can strongly type the arguments, and I think it reduces the cognitive load if the string exactly matches the prop set in the template. Also, we only have one page in the docs to explain how it works, rather than seven.

### @danielroe — 2 reactions  
`👍 2`  ·  [link](https://github.com/nuxt/nuxt/pull/31192#issuecomment-2776348183)

> I think we could add support in the html-transform plugin for detecting if `defineLazyHydrationComponent` is used?

### @Mini-ghost — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/nuxt/nuxt/pull/31192#issuecomment-2821601548)

> Hi @jakubm95 ! My apologies for the delay. I've completed the initial version of the code, and after testing, it appears to be working as expected.  
> 
> You can try it out using the following StackBlitz link to see if it addresses the issue you mentioned:
> 👉 https://stackblitz.com/edit/nuxt-starter-dexhojfw?file=app.vue
> 
> I believe the Nuxt core team will review it as soon as possible. Thank you for your patience and understanding.

### @Mini-ghost — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/nuxt/nuxt/pull/31192#issuecomment-2776342219)

> I’ve noticed an issue:
> 
> ```vue
> <script setup lang="ts">
> const LazyMyComponent = defineLazyHydrationComponent('time', () => import('~/components/MyComponent.vue'))
> </script>
> 
> <template>
>   <div>
>     <LazyMyComponent
>       :hydrate-after="500"
>     />
>   </div>
> </template>
> ```
> 
> This causes a conflict between auto-import and macro usage:
> 
> ```
> Uncaught (in promise) SyntaxError: Identifier 'createLazyTimeComponent' has already been declared
> ```
> 
> I may need to spend some time investigating how to resolve this issue!  
> If you have any suggestions or ideas, I’d really appreciate your guidance.

### @Mini-ghost — 0 reactions  
`—`  ·  [link](https://github.com/nuxt/nuxt/pull/31192#issuecomment-2708028965)

> Thank you for your feedback! I’ll take some time to explore how to improve this further.
> 
> I’m not sure if defining `hydrationStrategy` as a static string would provide a better DX, and if it would also make the compiler to analysis easier. What do you think?

### @Mini-ghost — 0 reactions  
`—`  ·  [link](https://github.com/nuxt/nuxt/pull/31192#issuecomment-2781521164)

> I'm not entirely sure if this is the correct approach, but to address this issue, perhaps we should check for existing variable declarations during the `nuxt:components-loader-pre` transformation.  
> 
> For example, in the following scenario, we might want to skip the transformation:
> 
> ```vue
> <script setup lang="ts">
> const LazyMyComponent = defineLazyHydrationComponent('time', () => import('~/components/MyComponent.vue'))
> </script>
> 
> <template>
>   <div>
>     <LazyMyComponent :hydrate-after="500" />
>   </div>
> </template>
> ```
> 
> Currently, however, `<LazyMyComponent :hydrate-after="500" />` gets transformed into `<LazyTimeMyComponent :hydrate-after="500" />`, which leads to the issue previously mentioned.
> 
> <img width="1380" alt="截圖 2025-04-07 凌晨1 14 04" src="https://github.com/user-attachments/assets/0c13cbda-7448-4cd1-a987-03c52566372f" />
> 
> Would love to hear your thoughts on this approach, in case there's a better solution I might have missed.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
