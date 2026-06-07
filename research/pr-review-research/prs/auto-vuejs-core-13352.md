# vuejs/core #13352 — fix(compiler-sfc): add error handling for defineModel() without variable assignment

**[View PR on GitHub](https://github.com/vuejs/core/pull/13352)**

| | |
|---|---|
| **Author** | @runyasak |
| **Status** | ✅ merged |
| **Opened** | 2025-05-18 |
| **Repo** | curated review-culture seed |
| **Diff** | +22 / −3 across 3 files |
| **Engagement** | 16 conversation · 10 inline review comments |

## Top review comments (ranked by reactions)

### @edison1105 — 1 reactions  
`👍 1`  ·  [link](https://github.com/vuejs/core/pull/13352#issuecomment-2889299796)

> ```js
> export enum DOMErrorCodes {
>   X_V_HTML_NO_EXPRESSION = 53 /* ErrorCodes.__EXTEND_POINT__ */,
> ```
> 
> `X_V_HTML_NO_EXPRESSION` should be updated to 54 due to `X_DEFINE_MODEL_NO_VARIABLE` being added

### @edison1105 — 1 reactions  
`👍 1`  ·  [link](https://github.com/vuejs/core/pull/13352#issuecomment-2889349921)

> @runyasak 
> https://github.com/vuejs/core/actions/runs/15101991112/job/42444363129?pr=13352
> The failed tests should be updated.

### @runyasak — 1 reactions  
`🎉 1`  ·  [link](https://github.com/vuejs/core/pull/13352#issuecomment-2889388184)

> @edison1105 @KazariEX Thank you so much for helping me. 😁

### @Kuba314 — 1 reactions  
`👍 1`  ·  [link](https://github.com/vuejs/core/pull/13352#issuecomment-2911809633)

> Hi, this change got included in version `3.5.15`, which is a patch version bump, however it added an error to a previously working code. Isn't this technically a breaking change and should only be included in a major version bump?
> 
> Previously, named models worked fine. Consider the following code, which previously didn't throw any errors:
> ```vue
> <script setup>
> defineModel("value");  // <-- this is now an error
> </script>
> <template>
>   {{ value }}
> </template>
> ```

### @edison1105 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/vuejs/core/pull/13352#issuecomment-2914526800)

> @runyasak 
> >  would you prefer to change this to a warning instead of throwing an error?
> 
> I don't think so, `defineModel` without an available assignment is valid usage. 
> #13280 has a workaround and it's an edge case. 
> A suitable fix has not been thought of yet.

### @runyasak — 0 reactions  
`—`  ·  [link](https://github.com/vuejs/core/pull/13352#issuecomment-2889339450)

> >X_V_HTML_NO_EXPRESSION should be updated to 54 due to X_DEFINE_MODEL_NO_VARIABLE being added
> 
> @edison1105 I have updated it for testing but forgot to commit. I will commit this change soon. Thank you so much.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
