# pmndrs/zustand #2912 — chore(eslint): migrate to flat config and simplify

**[View PR on GitHub](https://github.com/pmndrs/zustand/pull/2912)**

| | |
|---|---|
| **Author** | @sukvvon |
| **Status** | ✅ merged |
| **Opened** | 2024-12-18 |
| **Repo importance** | ★58,206 · 2,066 forks · score 71,444 |
| **Diff** | +1172 / −1014 across 10 files |
| **Engagement** | 51 conversation · 56 inline review comments |

## Top review comments (ranked by reactions)

### @dai-shi — 2 reactions  
`👍 1 · 👀 1`  ·  [link](https://github.com/pmndrs/zustand/pull/2912#issuecomment-2551326726)

> Our ecosystem still depends on eslint plugins. Maybe, eslint-plugin-react-compiler is one of the biggest hurdles. Let's stick with eslint.

### @dai-shi — 2 reactions  
`👍 1 · 👀 1`  ·  [link](https://github.com/pmndrs/zustand/pull/2912#issuecomment-2559807826)

> tslib seems a peer dependency of `@rollup/plugin-typescript`, so we need to install it  explicitly after removing `eslint-*-prettier`.

### @dai-shi — 2 reactions  
`👍 1 · 👀 1`  ·  [link](https://github.com/pmndrs/zustand/pull/2912#issuecomment-2564723045)

> > After this PR is merged, I will think of a better way to utilize `eslint` for the `examples`.
> 
> Please finish up zustand and valtio PRs first.

### @dai-shi — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/pmndrs/zustand/pull/2912#issuecomment-2550152941)

> This is nice! I wasn't sure when all plugins are ready. They weren't when I last tried.
> Are you sure all configs are migrated? No additions or removals?

### @dbritto-dev — 1 reactions  
`👀 1`  ·  [link](https://github.com/pmndrs/zustand/pull/2912#issuecomment-2551200599)

> @dai-shi @sukvvon IMHO, I prefer no config or simple config instead of complex config. In this case I'll keep the current config. We can use something else like OXC lint or Biome and simplify the config.

### @dai-shi — 1 reactions  
`👍 1`  ·  [link](https://github.com/pmndrs/zustand/pull/2912#issuecomment-2558977895)

> > so in my opinion, it's good to remain `eslint.config.js` in `examples/demo` but change file extension `js` to `mjs` that you want.
> 
> Good point. I missed it. Yeah, let's keep the file with `.mjs`.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
