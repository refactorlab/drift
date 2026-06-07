# microsoft/TypeScript #57465 — Infer type predicates from function bodies using control flow analysis

**[View PR on GitHub](https://github.com/microsoft/TypeScript/pull/57465)**

| | |
|---|---|
| **Author** | @danvk |
| **Status** | ✅ merged |
| **Opened** | 2024-02-21 |
| **Diff** | +3,229 / −97 across 18 files |
| **Engagement** | 141 conversation comments · 28 inline review comments |

## Why this PR is notable

Inferring type predicates from function bodies. `fatcerberus` posts a minimal breaking example; `danvk` answers `RyanCavanaugh`'s 'is it worth it?' pushback with an **enumerated correctness argument**.

## 🧠 The lesson for reviewers

> Counter a 'not worth it' with a **structured list of concrete advantages**; surface risks with the smallest possible repro.

## How the author framed it (PR description excerpt)

> Fixes #16069
> Fixes #38390
> Fixes #10734
> Fixes #50734
> Fixes #12798
> 
> This PR uses the TypeScript's existing control flow analysis to infer type predicates for boolean-returning functions where appropriate. For example:
> 
> ```ts
> function isString(x: string | number) {
>   return typeof x === 'string';
> }
> ```
> 
> This currently has an inferred return type of `boolean`, but with this PR it becomes a type predicate:
> 
> <img width="677" alt="image" src="https://github.com/microsoft/TypeScript/assets/98301/993a0606-e220-4565-be79-77cca9d3020c">
> 
> I filed #16069 seven years ago (!) and thought it would be interesting to try and fix it. It turned out to be cleaner and simpler than I thought: only ~65 LOC in one new function. I think it's a nice win!
> 
> ## How this works
> 
> A function is a candidate for an inferred type guard if:
> 
> 1. It does not have an explicit return type or type predicate.
> 2. Its inferred return type is `boolean`.
> 3. It has a single `return` statement and no implicit returns (this could potentially be relaxed later).
> 4. It does not mutate its parameter.
> 
> If so, then the function looks something like this:
> 
> ```ts
> function f(p: T, p2: T2, ...) {
>   // ...
>   return expr;
> }
> ```
> 
> For each parameter, this PR determine what its flow type would be in each branch if the function looked like this instead:
> 
> ```ts
> function f(p: T, p2: T2, ...) {
>   // ...
>   if (expr) {
>     p1;  // trueType
>   }
> }
> ```
> 
> if `trueType != T` then we have a _candidate_ for a type predicate.
> 
> We still need to check what a `false` return value means because of the semantics of type predicates. If we have:
> 
> ```ts
> declare function isString(x: string | number): x is string;
> ```
> 
> then `x` is a `string` if this function re …​ *[truncated]*

## Highest-signal comments (ranked by reactions)
> ⚠️ Only the first 100 conversation comments were fetched (API page limit); a later comment could out-rank these.


### @NWYLZW — 19 reactions  
`👍 11 · ❤️ 1 · 🎉 1 · 🚀 2 · 👀 4`  ·  [link](https://github.com/microsoft/TypeScript/pull/57465#issuecomment-1959011646)

> This idea is great! I seem to have come up with an implementation for fallback that doesn't require compilation support.
> ```ts
> declare const notMatched: unique symbol
> function isWhat<Input = unknown, T = never>(
>   match: (input: Input, _: typeof notMatched) => T | typeof notMatched
> ): (
>   (x: Input) => x is [T] extends [Input] ? Input & T : never
> ) {
>   return ((x: any): boolean => {
>     try {
>       return match(x, notMatched) !== notMatched
>     } catch (e) {
>       if ([notMatched, void 0, null, TypeError].includes(e as any)) {
>         return false
>       }
>       throw e
>     }
>   }) as any
> }
> 
> const strs0 = [1, '1', true].filter(
> //    ^? string[]
>   isWhat((t, _) => typeof t === 'string' ? t : _)
> )
> 
> const strs1 = [1, '1', true].filter(
> //    ^? string[]
>   isWhat(t => {
>     if (typeof t === 'string') return t
>     throw void 0
>   })
> )
> ```
> [playground](https://www.typescriptlang.org/play?#code/MYewdgzgLgBGJQLIEMrABYFMAmAuGArmAJYCOBmMEAngLYBGIANjALwwDKdjTAFAOTwkqDDn4BKAFAAzIsCjFwMYhADq6VAB4AkmAAOBWOyIBreAHcwAGhgAVNnEwA3TACcAfL0kwYtEenxeYn1DfF0DKBsAfXwoaj1MEGk4BBQ0LGxxNnc7GAAfGDiEpJThdJxJcUDvGF4ADzCQqCzWHLrlCBgAbVsAXRhMOqhMMGxOrvDDfoB+GEnYADJc-DBnN0qYAG8a10woAlcwWvr8ZDBqKphGZkwz7K2anyhXagefd5hd-cPff3qbIRpUSZGAAQlY7EB-gqHwAvjBgP5apgstsPj5iMleF0oeVsDYnCBiNgYAAGAEEJhMGy2eKYACirlcIFcvQAdMFgEwCNhMBBeJRkJ0zhdUY90V8DkdpMgmBBMOKfLDFYV0MzzANxcqlVkhTARZJlZJQJBYNBXBBSQ4ugBGGz8G38GzPCjs6TEJjDVxeAD0Po+AD1pjUVOpULxeJEYFEWjkiolkkYITB+ObggBzfgwWawfAxyqSY3gaBUZ4QG3Wu0px3O1yutnuz1uX3+95BkNqDRQSP3NHvTG1eMlJPsVPPDMST57KWFcVQNUgDWE4lkmqwqTiIA)
> 
> However, this requires an import. But we can simplify the usage of this function by using webpack or built-in global functions.
> If this pull request can be appr …​ *[truncated]*


### @danvk — 7 reactions  
`👍 7`  ·  [link](https://github.com/microsoft/TypeScript/pull/57465#issuecomment-1966795943)

> Thanks for the notes @RyanCavanaugh. Is the primary concern at this point performance? If this were zero cost, would we do it?
> 
> > Having to annotate `x is T` in a function declaration is not much effort, not very annoying, and is probably quite rare in practice since the only type guards likely to be correct are the ones you wouldn't usually bother writing a function for:
> 
> I'm not sure I agree with this. Three advantages of the inferred guard are:
> 
> 1. It's going to be correct, whereas your `x is T` is no safer than a type assertion.
> 2. You may not know that type predicates are even a thing in TS, in which case the inference is educational.
> 3. `T` may be nontrivial. https://github.com/microsoft/TypeScript/pull/57552#issuecomment-1965373678 is a good example of this -- are you really going to write out all five possible node types in a type predicate?
> 
> > Having to write `x is T` in a function expression position is super annoying - you need parens, are likely to break over a line length limit as a result, and this makes the entire line much more difficult to read:
> 
> I certainly agree with this. A version of this PR that only applied to function expressions passed as arguments to another function could be a gentle, minimally disruptive way to introduce this form of inference.
> 
> > I'd be interested if we could somehow scan the top100 or whatever and just flag when an inferred predicate matches a declared predicate, i.e. how often are we "saving an annotation" by inference under this PR. That'd also be a useful way to validate if this is _over_-inferring, i.e. finding predicates that are functionally or semantically not supposed to be predicates.
> 
> One way we could test this is b …​ *[truncated]*


### @fatcerberus — 5 reactions  
`👍 4 · 👀 1`  ·  [link](https://github.com/microsoft/TypeScript/pull/57465#issuecomment-1957394162)

> I'm thinking this will break things like...
> ```ts
> let isNumberable = (x: string | number) => typeof x === 'number';
> isNumberable = x => !isNaN(parseInt(String(x)));
> ```
> ...as a function returning `boolean` is not assignable to a type predicate.  This example is pretty contrived, but might be relevant for class inheritance (i.e. legal subclasses become illegal because the base class method now gets inferred as a typeguard).


### @danvk — 4 reactions  
`👍 3 · 👀 1`  ·  [link](https://github.com/microsoft/TypeScript/pull/57465#issuecomment-1957751656)

> @fatcerberus true, but that can also cut the other way! See the deleted errors file for `javascriptThisAssignmentInStaticBlock.ts`.
> 
> Ryan pointed out on another issue that inferring a type guard breaks this sort of code as well https://github.com/microsoft/TypeScript/issues/38390#issuecomment-626019466
> 
> ```ts
> const a = [1, "foo", 2, "bar"].filter(x => typeof x === "string");
> a.push(10);  // ok now, error with my PR
> ```
> 
> I assume the +3.89% check time on compiler-unions is bad? Is there any information on how I can run this locally and see what's going on?
> 
> The CI/self-check found a flaw in my criteria for inferring a type predicate. I actually need to be even more strict! I should not infer a type predicate for this function, even though `Exclude<unknown, string> = unknown`.
> 
> ```ts
> function isShortString(x: unknown) {
>   return typeof x === 'string' && x.length < 10;
> }
> 
> declare let str: string;
> if (isShortString(str)) {
>   str;  // string
> } else {
>   str;  // never
> }
> ```
> 
> This is actually quite interesting. My approach has no way of distinguishing `isShortString` from:
> 
> ```ts
> function isString(x: unknown) {
>   return typeof x === 'string';
> }
> ```
> 
> They both have `initType=unknown`, `trueType=string` and `falseType=unknown`. It would be valid to infer a type guard for `isShortString` if it were only ever called with `unknown` types. But if you call it with something like `string` or `string | number` then you can see that one is a valid type guard while the other is not.
> 
> I need to think a little more about whether this is fixable or if it's a flaw with this whole approach.


---
*Data pulled live from the GitHub REST API. Reaction counts are a snapshot at fetch time.*
