# remix-run/react-router #12019 — Typesafety improvements

**[View PR on GitHub](https://github.com/remix-run/react-router/pull/12019)**

| | |
|---|---|
| **Author** | @pcattori |
| **Status** | ✅ merged |
| **Opened** | 2024-09-19 |
| **Repo** | curated review-culture seed |
| **Diff** | +1114 / −85 across 35 files |
| **Engagement** | 29 conversation · 17 inline review comments |

## Top review comments (ranked by reactions)

### @david-crespo — 1 reactions  
`👍 1`  ·  [link](https://github.com/remix-run/react-router/pull/12019#issuecomment-2369246757)

> Looking forward to this feature. I enjoyed reading the decision doc. I wasn't familiar with TS LSP plugins, so I looked them up and found this in the [TS wiki](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin):
> 
> > TypeScript Language Service Plugins ("plugins") are for changing the editing experience only. The core TypeScript language remains the same. Plugins can't add new language features such as new syntax or different typechecking behavior, and plugins aren't loaded during normal commandline typechecking or emitting, (so are not loaded by tsc).
> 
> If this is true, then it seems like a big downside of the plugin approach that's worth addressing. If it is not true and `tsc` on the command line _will_ turn up type errors from the generated types, then that would be worth mentioning as well. When I saw LSP plugin, I immediately wondered how it will work on the command line.
> 
> **Edit:** Ok, and that's why you don't comment on work in progress: https://github.com/remix-run/react-router/blob/2d5e406e496cbd9de7b00b5c1185b619472009cd/decisions/0013-zero-effort-typesafety.md?plain=1#L79-L87

### @pcattori — 0 reactions  
`—`  ·  [link](https://github.com/remix-run/react-router/pull/12019#issuecomment-2369281642)

> > Looking forward to this feature. I enjoyed reading the decision doc. I wasn't familiar with TS LSP plugins, so I looked them up and found this in the [TS wiki](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin):
> > 
> > > TypeScript Language Service Plugins ("plugins") are for changing the editing experience only. The core TypeScript language remains the same. Plugins can't add new language features such as new syntax or different typechecking behavior, and plugins aren't loaded during normal commandline typechecking or emitting, (so are not loaded by tsc).
> > 
> > If this is true, then it seems like a big downside of the plugin approach that's worth addressing. If it is not true and `tsc` on the command line _will_ turn up type errors from the generated types, then that would be worth mentioning as well. When I saw LSP plugin, I immediately wondered how it will work on the command line.
> > 
> > **Edit:** Ok, and that's why you don't comment on work in progress:
> > 
> > https://github.com/remix-run/react-router/blob/2d5e406e496cbd9de7b00b5c1185b619472009cd/decisions/0013-zero-effort-typesafety.md?plain=1#L79-L87
> 
> For onlookers: its worth calling out that everything in this decision doc (`#0012`) keeps typechecking working as expected. The only things proposed in `#0012` are automatically running typegen in watch mode and adding some editor DX features. As you point out (`#0013`) is where this limitation of TS plugins is relevant.

### @david-crespo — 0 reactions  
`—`  ·  [link](https://github.com/remix-run/react-router/pull/12019#issuecomment-2369474033)

> I think what threw me off is that the first paragraph of the Typegen section makes it sound like typegen is primarily about file-based route config.
> 
> https://github.com/remix-run/react-router/blob/624093f9278e5ac2ca9a41697c9b1b4f1269ca06/decisions/0012-type-inference.md?plain=1#L161-L166
> 
> But from doc 13 it sounds like the language service is still leveraging the typegen directory behind the scenes for programmatic routing, you just don't have to annotate the route exports yourself.
> 
> https://github.com/remix-run/react-router/blob/2d5e406e496cbd9de7b00b5c1185b619472009cd/decisions/0013-zero-effort-typesafety.md?plain=1#L119-L128


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
