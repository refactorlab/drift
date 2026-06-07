# sympy/sympy #28265 — Simplification and extension of stability inequalities to domains

**[View PR on GitHub](https://github.com/sympy/sympy/pull/28265)**

| | |
|---|---|
| **Author** | @leomanga |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @oscarbenjamin
> The general convention in polys is that this function would be called `dup_routh_hurwitz`.

### @oscarbenjamin
> You can include the expression implementation with the others in polys...The EXRAW domain is precisely just 'expressions' so there can be an implementation for EXRAW.

### @oscarbenjamin
> This function should just return domain elements. You can convert them to `Expr` somewhere else.

### @oscarbenjamin
> I think we need some sort of systematic testing e.g. by randomly testing many examples for correctness...I find it quite hard to verify the correctness of the EXRAW algorithm.

### @oscarbenjamin
> These two functions could be combined into one

### @oscarbenjamin
> This is mutating the argument `previous_cond` in-place...It would be better to make it two variables.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
