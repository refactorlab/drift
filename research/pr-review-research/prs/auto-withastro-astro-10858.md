# withastro/astro #10858 — Actions experimental release

**[View PR on GitHub](https://github.com/withastro/astro/pull/10858)**

| | |
|---|---|
| **Author** | @bholmesdev |
| **Status** | ✅ merged |
| **Opened** | 2024-04-23 |
| **Repo importance** | ★59,861 · 3,515 forks · score 78,920 |
| **Diff** | +2320 / −52 across 51 files |
| **Engagement** | 19 conversation · 80 inline review comments |

## Top review comments (ranked by reactions)

### @florian-lefebvre — 0 reactions  
`—`  ·  [link](https://github.com/withastro/astro/pull/10858#issuecomment-2074978809)

> A few comments after watching the video:
> - It's really cool! (and not only because it uses AIK)
> - I wonder if it could be possible to provide a helper like `safe` to handle errors client side
> - What happen if you throw from within the action? Because `ActionError` seemed really input validation specific
> - Would be great to also be able to provide `output` zod schema for more optional strictness. Like if it's not provided, infer the handler return type otherwise take it's type

### @bholmesdev — 0 reactions  
`—`  ·  [link](https://github.com/withastro/astro/pull/10858#issuecomment-2075118108)

> Hey thanks for checking this out @florian-lefebvre!
> - Ah, I forgot to mention: `safe()` works on the client too 😄 For example, calling `const result = await safe(actions.like(...))` will give you the union type of error and success.
> - I didn't get to discuss exception throwing either. I intended `ActionError` to be the generic error object you throw from handler code if you want an explicit exception. I was thinking we follow the same signature as [TrpcError](https://trpc.io/docs/server/error-handling), which lets you set a human-readable `code` (maps to REST statuses) and a `message`. Validation errors use a special `ValidationError` class that extends `ActionError` to include a Zod payload as well. From your feedback, it sounds like "errors are just for validation" was the gut reaction. Worth some discussion on API refinements.
> - Good to know `output` is of interest to you! This is [also a feature of tRPC](https://trpc.io/docs/server/validators#output-validators). Were there any use cases brought this feature to mind for you?

### @bholmesdev — 0 reactions  
`—`  ·  [link](https://github.com/withastro/astro/pull/10858#issuecomment-2098844081)

> @matthewp Non-safe version has been removed 👍


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
