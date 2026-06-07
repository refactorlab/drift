# microsoft/TypeScript #56941 — Narrow generic conditional and indexed access return types when checking return statements

**[View PR on GitHub](https://github.com/microsoft/TypeScript/pull/56941)**

| | |
|---|---|
| **Author** | @gabritto |
| **Status** | ✅ merged |
| **Opened** | 2024-01-03 |
| **Diff** | +11,876 / −42 across 41 files |
| **Engagement** | 102 conversation comments · 45 inline review comments |

## Why this PR is notable

Narrowing generic conditional and indexed-access return types. `jakebailey` moves the design forward by proposing a concrete *mechanism* (*'introduce a flow node at each return…'*); `gabritto` verifies the shipped behavior against a real installable build.

## 🧠 The lesson for reviewers

> Senior reviewers don't just flag problems — they **propose the implementation mechanism**, and they **verify claims against real builds**, not just the diff.

## How the author framed it (PR description excerpt)

> Fixes #33912.
> Fixes #33014.
> 
> ## Motivation
> 
> Sometimes we want to write functions whose return type is picked between different options, depending on the type of a parameter. For instance:
> 
> ```ts
> declare const record: Record<string, string>;
> declare const array: string[];
> 
> function getObject(group) {
>     if (group === undefined) {
>         return record;
>     }
>     return array;
> }
> 
> const arrayResult = getObject("group");
> const recordResult = getObject(undefined);
> ```
> 
> If we want to precisely express this dependency between the return type and the type of `nameOrId`, we have a few options.
> The first one is to use overloads:
> 
> ```ts
> declare const record: Record<string, string[]>;
> declare const array: string[];
> 
> function getObject(group: undefined): Record<string, string[]>;
> function getObject(group: string): string[];
> function getObject(group: string | undefined): string[] | Record<string, string[]>;
> function getObject(group: string | undefined): string[] | Record<string, string[]> {
>     if (group === undefined) {
>         return record;
>     }
>     return array;
> }
> 
> const arrayResult = getObject("group");
> const recordResult = getObject(undefined);
> ```
> 
> However, if you make a mistake in the implementation of the function and return the wrong type, TypeScript will not warn you. For instance, if instead you implement the function like this:
> 
> ```ts
> declare const record: Record<string, string[]>;
> declare const array: string[];
> 
> function getObject(group: undefined): Record<string, string[]>;
> function getObject(group: string): string[];
> function getObject(group: string | undefined): string[] | Record<string, string[]>;
> function getObject(group: string | undefined): string[] | Record<stri …​ *[truncated]*

## Highest-signal comments (ranked by reactions)
> ⚠️ Only the first 100 conversation comments were fetched (API page limit); a later comment could out-rank these.


### @gabritto — 8 reactions  
`👍 8`  ·  [link](https://github.com/microsoft/TypeScript/pull/56941#issuecomment-2691306253)

> > Pardon my ignorance but, this PR is merged, but the behavior doesn't seem to be there in the playground in 5.8.1-rc or Nightly, e.g. using this example from above:
> > 
> > ```ts
> > function getObject<T extends string | undefined>(group: T):
> >     T extends string ? string[] : T extends undefined ? Record<string, string[]> : never {
> >     if (group === undefined) {
> >         return {}; // error
> >     }
> >     return []; // error
> > }
> > ```
> > 
> > What release is this feature coming in? Thanks.
> 
> The feature got pulled from 5.8 because we needed to fix some aspects of its design. See https://github.com/microsoft/TypeScript/pull/61136. The current plan is to implement the necessary fix and re-add this feature on 5.9.


### @gabritto — 2 reactions  
`👍 2`  ·  [link](https://github.com/microsoft/TypeScript/pull/56941#issuecomment-2397853481)

> > Hey @gabritto, I've packed this into [an installable tgz](https://typescript.visualstudio.com/cf7ac146-d525-443c-b23c-0d58337efebc/_apis/build/builds/163836/artifacts?artifactName=tgz&fileId=FCAF4D861595C4CFC28691516AC6B69F642BE546875C2ED181BAFB43ABAF547E02&fileName=/typescript-5.7.0-insiders.20241007.tgz). You can install it for testing by referencing it in your `package.json` like so:
> > 
> > ```
> > {
> >     "devDependencies": {
> >         "typescript": "https://typescript.visualstudio.com/cf7ac146-d525-443c-b23c-0d58337efebc/_apis/build/builds/163836/artifacts?artifactName=tgz&fileId=FCAF4D861595C4CFC28691516AC6B69F642BE546875C2ED181BAFB43ABAF547E02&fileName=/typescript-5.7.0-insiders.20241007.tgz"
> >     }
> > }
> > ```
> > 
> > and then running `npm install`.
> > 
> > There is also a playground [for this build](https://www.typescriptlang.org/play?ts=5.7.0-pr-56941-53) and an [npm](https://www.npmjs.com/package/@typescript-deploys/pr-build/v/5.7.0-pr-56941-53) module you can use via `"typescript": "npm:@typescript-deploys/pr-build@5.7.0-pr-56941-53"`.;
> 
> @Andarist the playground, as requested


### @jakebailey — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/TypeScript/pull/56941#issuecomment-2040832147)

> We may be able to introduce a flow node at each return, which just walks back to every preceding node; theoretically that would be fine because the checker wouldn't normally walk it anyway?


### @gabritto — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/TypeScript/pull/56941#issuecomment-1888216014)

> @typescript-bot perf test this faster
> @typescript-bot perf test this public


---
*Data pulled live from the GitHub REST API. Reaction counts are a snapshot at fetch time.*
