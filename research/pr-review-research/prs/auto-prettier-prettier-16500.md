# prettier/prettier #16500 — Handle exception in needs parens with optional chaining

**[View PR on GitHub](https://github.com/prettier/prettier/pull/16500)**

| | |
|---|---|
| **Author** | @syi0808 |
| **Status** | ✅ merged |
| **Opened** | 2024-07-22 |
| **Repo** | curated review-culture seed |
| **Diff** | +376 / −15 across 7 files |
| **Engagement** | 18 conversation · 20 inline review comments |

## Top review comments (ranked by reactions)

### @fisker — 2 reactions  
`👍 2`  ·  [link](https://github.com/prettier/prettier/pull/16500#issuecomment-2243178671)

> **Prettier pr-16500**
> [Playground link](https://deploy-preview-16500--prettier.netlify.app/playground/#N4Igxg9gdgLgprEAuEAKA5nGBhaBnCAGzgBkJ0B+AOlQEpaADBkAGhAgAcYBLfZUAIYAnIRADuABWEI8yEAMJiBAT1lsARkIFgA1lgDKAgLaluUOMgBmCvHA1bdBjtrPpkMIQFc7IW0e7uXj5wAB4ccELcJrAKACoRUMLccLJI1oS2bHiuxACKnhDwVjY+AFZ4Ifo5cPmFFmklbACOBfASohyp8ngAtOZwACaDrCAeAtyErrhGRgJyCoQj2VDoxACCMB7c6p5tESRm9emZIAAWMEaEAOqn3PB4zmBw+jJ33ABud8pyYHhqIO9vABJKBDWD6MCRLhrUH6GDKYjFDI+DiiWxXLQcOSolIRd4WNhmWxCGDtAToWZIk7OITEuTqATqOCLNioswwK7cAYwU7IAAcAAY2EI4C1uCKyRS5g1kWwYIzOdzeUgAExsTy2WKM1LHYJGJkDIYDEgCFaeclwABiECEs02rnmuwgIAAvi6gA)
> 
> ```sh
> --parser babel
> ```
> 
> **Input:**
> 
> ```jsx
> (getConsoleLog?.())``
> ```
> 
> **Output:**
> 
> ```jsx
> getConsoleLog?.()``;
> 
> ```
> 
> **Second Output:**
> 
> ```jsx
> SyntaxError: Tagged Template Literals are not allowed in optionalChain. (1:1)
> > 1 | getConsoleLog?.()``;
>     | ^
>   2 |
> ```

### @fisker — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/prettier/prettier/pull/16500#issuecomment-2253904472)

> After we add/fix all tests.
> 
> We need rewrite the existing logic, currently it's a mess.
> 
> The logic should be:
> 
> 1. Check if it's root element of ChainExpression (Need two version, one for babel, one for estree)
> 2. Skip `TSNonNullExpession`
> 3. Check if it's `TemplateLiteral.tag` / `NewExpression.callee` / `CallExpression.callee` / `MemberExpression.object`
> 
> This can be done in the followup PR.

### @syi0808 — 1 reactions  
`👍 1`  ·  [link](https://github.com/prettier/prettier/pull/16500#issuecomment-2244554339)

> > There are two other cases need to fix.
> > 
> > ```ts
> > (a?.b)!``;
> > 
> > (a?.b!)``;
> > ```
> > 
> > Can you try to fix them?
> 
> Okay. I will try this.

### @fisker — 1 reactions  
`👍 1`  ·  [link](https://github.com/prettier/prettier/pull/16500#issuecomment-2253858177)

> > we can also move new expression also into chain expression in this pr?
> 
> Let's not make this huge. We don't know what we will face. I'm going to merge this first.

### @syi0808 — 0 reactions  
`—`  ·  [link](https://github.com/prettier/prettier/pull/16500#issuecomment-2243338599)

> In addition to the case you mentioned, i considered a few more exceptional cases.

### @fisker — 0 reactions  
`—`  ·  [link](https://github.com/prettier/prettier/pull/16500#issuecomment-2244517948)

> Moved to `shouldAddParenthesesToChainElement` https://github.com/prettier/prettier/pull/16500/commits/ac500788b3d72b28b19c10aa8a8880a4118cbf56


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
