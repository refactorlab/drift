# DefinitelyTyped/DefinitelyTyped #68232 — @types/eslint allow non-ESTree AST for parsers in flat configs

**[View PR on GitHub](https://github.com/DefinitelyTyped/DefinitelyTyped/pull/68232)**

| | |
|---|---|
| **Author** | @mostpinkest |
| **Status** | ✅ merged |
| **Opened** | 2024-01-17 |
| **Repo importance** | ★51,250 · 30,468 forks · score 178,119 |
| **Diff** | +13 / −1 across 1 files |
| **Engagement** | 68 conversation · 10 inline review comments |

## Top review comments (ranked by reactions)

### @wooorm — 5 reactions  
`👍 2 · ❤️ 2 · 😄 1`  ·  [link](https://github.com/DefinitelyTyped/DefinitelyTyped/pull/68232#issuecomment-1902593579)

> 1) `types/estree` already support this. That’s how `types/estree-jsx` works.
> 2) you don’t need it a) never or b) everywhere, just like you don’t need to use no dependencies from npm or all dependencies from npm, you can use it *sometimes*
> 3) From quickly glancing over this PR and the conversation, it looks like this is only making the `ast` and `scopeManager` fields on `ESLintParseResult` extendable into unions. But, I am only here because I got pinged, I haven’t thoroughly read everything, nor do I particular care much what y’all are choosing in ESLint!

### @bradzacher — 4 reactions  
`👍 2 · ❤️ 2`  ·  [link](https://github.com/DefinitelyTyped/DefinitelyTyped/pull/68232#issuecomment-1903723279)

> > why did you declare all ESLint Node types in @typescript-eslint/parser?
> 
> Because at the time (some 6 years ago) the estree types were fixed and inextensible. The eslint types similarly so.
> 
> Because we needed to define brand new everything - new nodes in every single union, new keys on existing nodes, a new scope manager, new visitor keys.
> 
> Because we wanted control of our workflow rather than relying on an external repo with an external contributor base and release workflow.
> 
> Becuase we don't want our stability to be based off of types whose contributions we don't control. I.e. Imagine someone merged a breaking change in the ESTree types that we weren't aware of - now our users would be fubar.
> 
> Additionally by splitting off we've devised a much better way of declaring our types rather than one monolithic file and a better way of documenting things and a better way of testing things.
> 
> We as a massive project are much better off with our own types rather than relying on declaration merging.
> 
> We also are the parser used by ~70% of eslint users - so it's not something that should just be ignored and hand-waved away with "just use an ignore comment".

### @JounQin — 1 reactions  
`👍 1`  ·  [link](https://github.com/DefinitelyTyped/DefinitelyTyped/pull/68232#issuecomment-1903336936)

> First of all, `any` doesn't make any sense, you should use `as unknown as X` or a simple `// @ts-expect-error` which is the correct solution for workaround.
> 
> Secondly, in my linked codes, the `FlatConfig` has correct typings without `any`, with your changes, there could be unintended bugs due to loose typings.
> 
> So my two cents, we should move forward to the route of `Declaration Merging`directly, it's hard indeed, but it's worth.

### @JounQin — 1 reactions  
`😄 1`  ·  [link](https://github.com/DefinitelyTyped/DefinitelyTyped/pull/68232#issuecomment-1913794892)

> @JoshuaKGoldberg
> 
> Actually I was surprised that @bradzacher and you partly agree to use `any` which is absolutely forbidden in @typescript-eslint codebase, and we even have a rule to forbid it specifically.
> 
> The current situation is, the world works a long time without this PR, `any` or any other solutions. So I don't think it's in emergency. While it's a great time to use `Declaration Merging` to unify all eslint typings usage, just like the succeeded `unified` ecosystem.

### @mostpinkest — 1 reactions  
`👍 1`  ·  [link](https://github.com/DefinitelyTyped/DefinitelyTyped/pull/68232#issuecomment-1913803474)

> > the world works a long time without this PR
> 
> Again, this has only become an issue *now* due to ESLint moving to a new config format which allows typechecking on the parsers in the config.

### @mostpinkest — 0 reactions  
`—`  ·  [link](https://github.com/DefinitelyTyped/DefinitelyTyped/pull/68232#issuecomment-1895860436)

> @bradzacher Sorry, should've explained myself before I submitted the pr. 😅
> 
> I've updated the description to include an explanation. Let me know if anything is unclear.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
