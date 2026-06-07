# nodejs/node #53725 — module: add --experimental-strip-types

**[View PR on GitHub](https://github.com/nodejs/node/pull/53725)**

| | |
|---|---|
| **Author** | @marco-ippolito |
| **Status** | ✅ merged |
| **Opened** | 2024-07-04 |
| **Diff** | +2,190 / −25 across 89 files |
| **Engagement** | 144 conversation comments · 117 inline review comments |

## Why this PR is notable

Type-stripping in Node (`--experimental-strip-types`). `DanielRosenwasser` shows up *as a member of the TypeScript team* to 'urge caution'; `panva` and `enricopolanski` bring concrete, reproducible module-resolution failure cases (`.js`-in-imports resolving to `.ts`).

## 🧠 The lesson for reviewers

> Highest-value reviews import **outside-team expertise** and argue from **specific, reproducible failure scenarios**, not taste.

## How the author framed it (PR description excerpt)

> It is possible to execute TypeScript files by setting the experimental flag `--experimental-strip-types`.
> Node.js will transpile TypeScript source code into JavaScript source code.
> During the transpilation process, no type checking is performed, and types are discarded.
> 
> ### Roadmap
> 
> Refs: https://github.com/nodejs/loaders/issues/217
> 
> ### Motivation
> 
> I believe enabling users to execute TypeScript files is crucial to move the ecosystem forward, it has been requested on all the surveys, and it simply cannot be ignored. We must acknowledge users want to run `node foo.ts` without installing external dependencies or loaders.
> 
> > There is a TC39 proposal for [type annotations](https://github.com/tc39/proposal-type-annotations)
> 
> ### Why type stripping
> 
> Type stripping as the name suggest, means removing all the `types`,  transform the input in a JavaScript module.
> 
> ```typescript
> const foo: string = "foo";
> ```
> 
> Becomes:
> 
> ```javascript
> const foo = "foo";
> ```
> Other runtimes also perform transformation of some TypeScript only features into JavaScript, for example enums, which do not exists in JavaScript.
> At least initially in this PR no trasformation is performed, meaning that using `Enum`, `namespaces` etc... will not be possible.
> 
> ### Why I chose @swc/wasm-typescript
> 
> Because of *simplicity*.
> I have considered other tools but they require either rust or go to be added to the toolchain.
> `@swc/wasm-typescript` its a small package with a wasm and a js file to bind it.
> Swc is currently used by Deno for the same purpose, it's battle tested.
> In the future I see this being implemented in  **native layer**.
> Massive shoutout to @kdy1 for releasing a swc version for us.
> 
> ---
> 
> ⚠️ Refer to the …​ *[truncated]*

## Highest-signal comments (ranked by reactions)
> ⚠️ Only the first 100 conversation comments were fetched (API page limit); a later comment could out-rank these.


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
> We actually have precedent here. When we first collaborated with Babel to support TypeScript features, we tried to implement it in a "pure" way by omitting constructs like `namespace`s; but in practice, this didn't last very long. Very early on, one of the biggest complaints was a lack of support for those omitted features. Those features have been implemented in Babel as well as other tools that understand TypeScript. If Node.js implements only a subset, I think we'll see a similar story, but with a lot more pain, as Node.js has a much larger user base and has to be much mo …​ *[truncated]*


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
> If supporting a "later stage" compilation with `tsc` is a non-goal, then it's ok to support running `.ts` in `node_modules` and a lot of other things. But at that point, we are essentially drafting a _new language_. I don't see how we have the bandwidth/budget for it long term.


---
*Data pulled live from the GitHub REST API. Reaction counts are a snapshot at fetch time.*
