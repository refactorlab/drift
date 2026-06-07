# DefinitelyTyped/DefinitelyTyped #70563 — feat: types for `express` 5

**[View PR on GitHub](https://github.com/DefinitelyTyped/DefinitelyTyped/pull/70563)**

| | |
|---|---|
| **Author** | @RobinTail |
| **Status** | ✅ merged |
| **Opened** | 2024-09-14 |
| **Repo importance** | ★51,250 · 30,468 forks · score 178,119 |
| **Diff** | +2216 / −32 across 35 files |
| **Engagement** | 42 conversation · 53 inline review comments |

## Top review comments (ranked by reactions)

### @jakebailey — 2 reactions  
`🎉 1 · 😄 1`  ·  [link](https://github.com/DefinitelyTyped/DefinitelyTyped/pull/70563#issuecomment-2374744651)

> > What's next, @jakebailey ?
> 
> Me waking up and approving it 😄

### @AviVahl — 2 reactions  
`👍 2`  ·  [link](https://github.com/DefinitelyTyped/DefinitelyTyped/pull/70563#issuecomment-2376746104)

> I wonder, the following now fails linting:
> ```ts
> import { createServer } from 'node:http';
> import express from 'express';
> 
> const app = express();
> const httpServer = createServer(app);
> ```
> with: `Promise returned in function argument where a void return was expected. eslint@typescript-eslint/no-misused-promises`
> 
> when using type-checked `typescript-eslint` configuration.
> 
> This is because app is typed as `core.Express` which extends `Application` which extends `IRouter` which extends `RequestHandler`, which now returns both `void` and `Promise<void>`.
> 
> **If this is a valid case** (`Application` being a valid node http request handler), perhaps make it so it's typed as returning `void`, while still accepting async request handlers in `.use(...)`? I mean, if express handles promise rejections on its own... `void` alone might be fine. WDYT?

### @AviVahl — 2 reactions  
`👍 2`  ·  [link](https://github.com/DefinitelyTyped/DefinitelyTyped/pull/70563#issuecomment-2376890941)

> the rule is only included in `configs.recommendedTypeChecked`, which also requires one to specify additional settings (such as `projectService` or `project`, etc.)
> 
> I realize I can disable lint for that line/file, cast the type, or disable rule. The thing is... I believe the rule is correct. The express handler possibly returns a Promise (according to the type), and node http handler doesn't handle promises. Just an FYI, since it might be a common use-case to use the app itself as handler for a native http server.
> 
> Not sure I want to tackle this on my own. I'll probably just workaround in user-end.

### @RobinTail — 1 reactions  
`👍 1`  ·  [link](https://github.com/DefinitelyTyped/DefinitelyTyped/pull/70563#issuecomment-2352782877)

> @tpluscode , could you approve your part plz?

### @jakebailey — 1 reactions  
`👍 1`  ·  [link](https://github.com/DefinitelyTyped/DefinitelyTyped/pull/70563#issuecomment-2369202777)

> @ryanblock You are an owner of `@types/architect__functions`, which this PR is modifying; the ping is correct.

### @jakebailey — 1 reactions  
`👍 1`  ·  [link](https://github.com/DefinitelyTyped/DefinitelyTyped/pull/70563#issuecomment-2372324146)

> To fix the CI error, `express-serve-static-core/v4` needs to be in `attw.json`.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
