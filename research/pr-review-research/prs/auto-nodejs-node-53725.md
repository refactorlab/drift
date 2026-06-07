# nodejs/node #53725 — module: add --experimental-strip-types

**[View PR on GitHub](https://github.com/nodejs/node/pull/53725)**

| | |
|---|---|
| **Author** | @marco-ippolito |
| **Status** | ✅ merged |
| **Opened** | 2024-07-04 |
| **Repo** | curated review-culture seed |
| **Diff** | +2190 / −25 across 89 files |
| **Engagement** | 144 conversation · 117 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @panva — 30 reactions  
`👍 30`  ·  [link](https://github.com/nodejs/node/pull/53725#issuecomment-2209274046)

> @marco-ippolito, speaking as a module maintainer here, it is very common for TS module codebases to have its own file imports written with `.js` extensions in the import statements, despite the files being `.ts`.
> 
> If I'm to replace `--import=tsx/esm` with `--experimental-strip-types`, or skip a compile step before testing, this would need to be able to resolve to a `.ts` file even when `.js` was in the statement (but not in the filesystem), otherwise I'll have to change the project imports and then deal with more pain from the compiler (or tsc typecheck) before emitting the actual module code to publish.

### @DanielRosenwasser — 20 reactions  
`👍 18 · 👀 2`  ·  [link](https://github.com/nodejs/node/pull/53725#issuecomment-2211325041)

> Hey everyone, I work on the TypeScript team and wanted to provide our perspective here. I really appreciate the enthusiasm for making it easier to run TypeScript code. That said, I want to really urge caution here. Supporting a subset of TypeScript has the potential to create a lot of confusion.
> 
> Part of the intent with the type annotations proposal was to actually enable the same sort of strategy: just ignore the types. I think separately, we believed that other features like enums could be standardized on their own merits. Even if not, there was at least a conceptual separation of JavaScript, which might just support types, and TypeScript, which might support a slightly broader concrete syntax and the other features that the language grew with.
> 
> Whether or not that separation is actually understandable is something that we have still heard a lot of concern about (and I don't want to get too off-topic here). I think the proposed behavior in this PR, where Node.js would claim to support TypeScript, but only a subset, would actually be a lot more confusing and lead to a lot of frustration in practice.
> 
> We actually have precedent here. When we first collaborated with Babel to support TypeScript features, we tried to implement it in a "pure" way by omitting constructs like `namespace`s; but in practice, this didn't last very long. Very early on, one of the biggest complaints was a lack of support for those omitted features. Those features have been implemented in Babel as well as other tools that understand TypeScript. If Node.js implements only a subset, I think we'll see a s … *[truncated]*

### @enricopolanski — 16 reactions  
`👍 15 · 👎 1`  ·  [link](https://github.com/nodejs/node/pull/53725#issuecomment-2210203604)

> I see few issues with the module approach:
> 
> 1) Usage of `.ts` extensions in imports and the `allowImportingTsExtensions` flag in TypeScript land is virtually non existent. Imports are either extensionless or use `.js` one (see point 2).
> 
> 2) To complicate things even further ESMs resolution in TypeScript is mostly achieved in codebases by adding `.js` extension to imports *even if the .js file at that path does not exist*.
> 
> https://www.typescriptlang.org/docs/handbook/modules/theory.html#module-resolution-for-libraries
> 
> This is especially important in library code (as many projects out of there simply opt-out of ESM entirely and either create bundles FE-wise, or they compile down to CJS for Node ones) but the number of real world products using this pattern increases consistently every day with CJS being phased out by an ever growing number of projects.
> 
> I wonder whether the flag could strip types and run `@swc/wasm-typescript` on files regardless of their extension. If it is a normal js file it will simply not need to strip anything (albeit it will still have to parse it).

### @mcollina — 13 reactions  
`👍 7 · ❤️ 6`  ·  [link](https://github.com/nodejs/node/pull/53725#issuecomment-2228163622)

> @GeoffreyBooth, we have two different views of this feature. I see it as part of the same ecosystem of tools in which `tsc` sits in. In other words, the same developers would use this capability at different stages of development, and they will compile their code with `tsc` or any other tool later on.
> 
> TypeScript does not have a language spec, but it is a compiler governed by a configuration file. Mandating a specific subset of it in the ecosystem would 100% cause compatibility issues in the future, and this is already very complex given the different module resolution strategies that are possible in `tsconfig.json` right now.
> In other terms, there is no "one size fits all" in typescript: a dependency usually has incompatible typescript settings of an application.
> Therefore, running `.ts` files that cannot be compiled by `tsc` unless a specific setting is applied would lead to two outcomes:
> 
> 1. a part of the ecosystem associates how a `.ts` extension is to be run to "our" interpretation (possibly also Deno's, Bun's and Workerd's if we can coordinate)
> 2. a part of the ecosystem will ignore this, and their pain will intesify.
> 
> Avoiding to run `.ts` files in `node_modules` prevents this by forcing dependencies to compile  their `.ts` files, and therefore allowing the flexibility that they currently enjoy without forcing a standard on them.
> 
> If supporting a "later stage" compilation with `tsc` is a non-goal, then it's ok to support running `.ts` in `node_modules` and a lot of other things. But at that point, we are essentially drafting a _new language_. I don't see how we have … *[truncated]*

### @marco-ippolito — 8 reactions  
`👍 8`  ·  [link](https://github.com/nodejs/node/pull/53725#issuecomment-2209278574)

> > @marco-ippolito, speaking as a module maintainer here, it is very common for TS module codebases to have its own file imports written with `.js` extensions in the import statements, despite the files being `.ts`.
> > 
> > If I'm to replace `--import=tsx/esm` with `--experimental-strip-types`, or skip a compile step before testing, this would need to be able to resolve to a `.ts` file even when `.js` was in the statement (but not in the filesystem), otherwise I'll have to change the project imports and then deal with more pain from the compiler before emitting the actual module code to publish.
> 
> This is something we definitely want look into, to be able to maintain compatibility with what you run and what you compile.
> It's in the checklist for future iterations, it might be resolved with extensions guessing (?), it requires further discussion.

### @rauschma — 7 reactions  
`❤️ 6 · 👀 1`  ·  [link](https://github.com/nodejs/node/pull/53725#issuecomment-2211021725)

> * Related work by @acutmore: https://gist.github.com/acutmore/27444a9dbfa515a10b25f0d4707b5ea2
> * Key idea: replace type syntax with spaces – then source code locations remain stable (great e.g. for stack traces).


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
