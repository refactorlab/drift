# TanStack/query #8960 — feat(react-query): add mutationOptions

**[View PR on GitHub](https://github.com/TanStack/query/pull/8960)**

| | |
|---|---|
| **Author** | @Ubinquitous |
| **Status** | ✅ merged |
| **Opened** | 2025-04-06 |
| **Repo importance** | ★49,637 · 3,868 forks · score 70,087 |
| **Diff** | +400 / −0 across 7 files |
| **Engagement** | 20 conversation · 35 inline review comments |

## Top review comments (ranked by reactions)

### @TkDodo — 3 reactions  
`❤️ 2 · 😄 1`  ·  [link](https://github.com/TanStack/query/pull/8960#issuecomment-2919813611)

> > you can achieve the same thing (avoiding type mistakes) by using satisfies UseMutationOptions
> 
> okay, it actually  needs to be `satisfies UseMutationOptions<any, any, any, any>`, and that won’t work for inference that well:
> 
> https://www.typescriptlang.org/play/?ssl=6&ssc=3&pln=6&pc=51#code/JYWwDg9gTgLgBAbwKoGcCmBZArjAhjYCAOwHkwDiUAaOLdbPCogXzgDMoIQ4ByAATxEUeAMYBrAPRQ0uETAC0ARyxooATx4BYAFChIsOLgAehaojgw1YNHACCJiCgCiUTlDisOXXsdNbtOiKU8BDkhEJwALyIOnAgOPjhAGJEAFyGKGpEInAAFEbpRFggAEaqAJRRAHxwAMowUMBEAOb55TqsKIkobMBoKHComAlMZEwoADy4RGo007OGM3MzVTqBweYAJvi4HlG09CPhuaHj7doSEnDXNwB6APxAA
> 
> guess we need that helper after all

### @manudeli — 2 reactions  
`👍 1 · 👀 1`  ·  [link](https://github.com/TanStack/query/pull/8960#issuecomment-2855683870)

> @Ubinquitous Resolve eslint error please

### @TkDodo — 1 reactions  
`👍 1`  ·  [link](https://github.com/TanStack/query/pull/8960#issuecomment-2875579684)

> yes, with optional chaining on the options callback:
> 
> ```
> useMutation({
>   ...options,
>   onSuccess: () => {
>     options?.onSuccess()
>     // added logic
>   },
> })
> ```

### @Ubinquitous — 1 reactions  
`👍 1`  ·  [link](https://github.com/TanStack/query/pull/8960#issuecomment-2875635278)

> To override queryOptions without using the spread operator twice, you can use a prop getter.
> 
> ```jsx
> const compose = (...functions) => (...args) =>
> 	functions.forEach((fn) => fn?.(...args))
> 
> const options = queryOptions({ ... })
> 
> const getOptions = ({ onSuccess }) => {
>   return {
>     onSuccess: compose(onSuccess, options.onSuccess),
>     ...options
>   }
> }
> 
> getOptions({
>   onSuccess: () => {} // behaves the same
> })
> ```

### @andredewaard — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/TanStack/query/pull/8960#issuecomment-2991585473)

> any ETA on this? would be really helpful in my current app.

### @Ubinquitous — 0 reactions  
`—`  ·  [link](https://github.com/TanStack/query/pull/8960#issuecomment-2844865128)

> Thank you for reviewing my PR. I thought queryOptions and mutationOptions could be structured similarly since it was an options-related function. I re-created useMutation as start. I changed it to only have UseMutationOptions, excluding unnecessary data tags and initialData.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
