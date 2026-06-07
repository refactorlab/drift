# microsoft/TypeScript #56941 — Narrow generic conditional and indexed access return types when checking return statements

**[View PR on GitHub](https://github.com/microsoft/TypeScript/pull/56941)**

| | |
|---|---|
| **Author** | @gabritto |
| **Status** | ✅ merged |
| **Opened** | 2024-01-03 |
| **Repo** | curated review-culture seed |
| **Diff** | +11876 / −42 across 41 files |
| **Engagement** | 102 conversation · 45 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

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

### @gabritto — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/TypeScript/pull/56941#issuecomment-1901462882)

> I did local perf testing of this branch vs main (commit 1982349339b9c1fd78c93195d572ffc6fd5041b0). I ran tsc on a project with 10 copies of a file with the code in https://github.com/microsoft/TypeScript/blob/c73638300f2e4621cb0538fd1123f8a2fdf9e5ab/tests/cases/compiler/dependentReturnType3.ts, which is adapted from existing functions in some github repos, by changing the functions to use generic conditional types as their return types, instead of overloads.
> 
> Results were:
> <details>
> <summary>Conditional return types: main vs PR</summary>
> <b>Comparison Report - main..gabritto/d2-detect</b>
> <table border="0" cellpadding="0" cellspacing="0" >
> <thead>
> <tr>
> <th align=left><sub>Metric</sub></th>
> <th align=right><sub>main</sub></th>
> <th align=right><sub>gabritto/d2-detect</sub></th>
> <th align=right><sub>Delta</sub></th>
> <th align=right><sub>Best</sub></th>
> <th align=right><sub>Worst</sub></th>
> <th align=right><sub>p-value</sub></th>
> </tr>
> </thead>
> <tr class="group"><th align=left colspan="7"><sub>condperfignore - node (v20.11.0, x64)</sub></th></tr>
> <tbody>
> <tr class="measurement memory scenario0 host0">
> <td align=left><sub>Memory used</sub></td>
> <td align=right><sub>89,742k (± 0.00%)</sub></td>
> <td align=right><sub>88,983k (± 0.00%)</sub></td>
> <td align=right><sub>-759k (- 0.85%)</sub></td>
> <td align=right><sub>88,983k</sub></td>
> <td align=right><sub>88,983k</sub></td>
> <td align=right><sub>p=0.000 n=10</sub></td>
> </tr>
> <tr class="measurement parse-time scenario0 host0">
> <td align=left><sub>Parse Time</sub></td>
> <td align=right><sub>0.92s (± 0.43%)</sub></td>
> <td align=right><sub> … *[truncated]*

### @gabritto — 0 reactions  
`—`  ·  [link](https://github.com/microsoft/TypeScript/pull/56941#issuecomment-1905196706)

> Still regarding perf, I did some profiling of my PR running on the same input as the perf test described above (the original version, with conditional return types and no casts to any). Looks like the PR roughly doubles the time spent on `checkReturnStatementExpression` (which doesn't exist on main but corresponds to checking the return statement expression + checking if the return statement expression's type is assignable to the function's return type). From that extra time the PR spends on that function, half of it is on detection of which expression to use as base for return type narrowing.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
