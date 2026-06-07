# microsoft/TypeScript #57465 — Infer type predicates from function bodies using control flow analysis

**[View PR on GitHub](https://github.com/microsoft/TypeScript/pull/57465)**

| | |
|---|---|
| **Author** | @danvk |
| **Status** | ✅ merged |
| **Opened** | 2024-02-21 |
| **Repo** | curated review-culture seed |
| **Diff** | +3229 / −97 across 18 files |
| **Engagement** | 141 conversation · 28 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

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
> However, this requires an import. But we can simplify the us … *[truncated]*

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
> > I'd be interested if we could somehow scan the top100 or whatever and just flag when an inferred predicate matches a declared predicate, i.e. how often are we "saving an annotation" by inference under this PR. That'd also be a useful way to validate if this is _over_-inferring, i.e. finding predicates t … *[truncated]*

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

### @ehoogeveen-medweb — 3 reactions  
`👍 3`  ·  [link](https://github.com/microsoft/TypeScript/pull/57465#issuecomment-1961450111)

> True/false branch only type guards are https://github.com/microsoft/TypeScript/issues/15048 I think.

### @fatcerberus — 1 reactions  
`👍 1`  ·  [link](https://github.com/microsoft/TypeScript/pull/57465#issuecomment-1957780248)

> Ouch, that's tricky.  If there's a `&&` present in the condition then you have to make sure there are no additional non-narrowing checks (or that the additional checks didn't narrow something else instead)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
