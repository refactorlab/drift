# prettier/prettier #17879 — Support format allow attribute of iframe

**[View PR on GitHub](https://github.com/prettier/prettier/pull/17879)**

| | |
|---|---|
| **Author** | @kovsu |
| **Status** | ✅ merged |
| **Opened** | 2025-09-10 |
| **Repo** | curated review-culture seed |
| **Diff** | +302 / −5 across 11 files |
| **Engagement** | 14 conversation · 29 inline review comments |

## Top review comments (ranked by reactions)

### @fisker — 1 reactions  
`👀 1`  ·  [link](https://github.com/prettier/prettier/pull/17879#issuecomment-3326930841)

> > > ~Several features can be controlled at the same time by including a semi-colon-separated list of policy directives inside the allow attribute. [(link)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Permissions_Policy#embedded_frame_syntax)~
> > 
> > we can see https://w3c.github.io/webappsec-permissions-policy/#algo-parse-policy-directive
> > 
> > > If tokens is an empty list, then [continue](https://infra.spec.whatwg.org/#iteration-continue)
> > 
> > So it will ignore the empty policies
> 
> Great, can you add this into code?

### @kovsu — 1 reactions  
`👍 1`  ·  [link](https://github.com/prettier/prettier/pull/17879#issuecomment-3331350149)

> and I handled `permissions-policy.js` similar to `style.js`.

### @fisker — 0 reactions  
`—`  ·  [link](https://github.com/prettier/prettier/pull/17879#issuecomment-3325581329)

> I'm sorry for delay on this, but before we continue, I have a few questions.
> 
> I need answers for
> 
> 1. What does the spec say about the empty policy?
> 
>    Is it safe to remove? Will browser ignore?
> 
>    ```html
>    <iframe allow="payment; ; serial"></iframe>
>    ```
> 
> 2. Is a trailing semicolon allowed?
> 
>    Are they equivalent?
> 
>    ```html
>    <iframe allow="payment"></iframe>
>    <iframe allow="payment;"></iframe>
>    ```
> 
>    If empty policies are simply ignored, this question is already answered.

### @kovsu — 0 reactions  
`—`  ·  [link](https://github.com/prettier/prettier/pull/17879#issuecomment-3326879404)

> > <del>Several features can be controlled at the same time by including a semi-colon-separated list of policy directives inside the allow attribute. [(link)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Permissions_Policy#embedded_frame_syntax
> )</del>
> 
> we can see https://w3c.github.io/webappsec-permissions-policy/#algo-parse-policy-directive
> 
> > If tokens is an empty list, then [continue](https://infra.spec.whatwg.org/#iteration-continue)
> 
> So it will ignore the empty policies

### @fisker — 0 reactions  
`—`  ·  [link](https://github.com/prettier/prettier/pull/17879#issuecomment-3327760216)

> Please fix the AST_COMPARE test, https://github.com/prettier/prettier/actions/runs/17972822715/job/51119298493?pr=17879#step:6:1851
> 
> I guess you know how to do it, since you already fixed it once in another PR.

### @kovsu — 0 reactions  
`—`  ·  [link](https://github.com/prettier/prettier/pull/17879#issuecomment-3331348198)

> Messed up something while resolving conflicts, but have cleaned up the unnecessary code.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
