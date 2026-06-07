# sympy/sympy #26412 — Implement the Coulomb kinetic friction actuator

**[View PR on GitHub](https://github.com/sympy/sympy/pull/26412)**

| | |
|---|---|
| **Author** | @eh111eh |
| **Status** | Merged (August 6, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @moorepants
> This looks like a good idea now. I would recommend that you build at least a two particle system and model it fully and even simulate it to see if your force design works.

### @moorepants
> If this is the default where u1 can be positive or negative, where is the `sign(u1)` term?

### @tjstienstra
> I agree that the unittest could be rewritten to use `to_loads`. However, the nice thing about testing the positive and negative case separately like this, is that you don't literally write out the same equations as in the source code.

### @moorepants
> Why isn't `v` present? And why is `x` present? The formulation is also quite complex, but maybe that is required to guarantee the signs are correct and have the most generality.

### @tjstienstra
> The extension velocity is defined as the length change over time...This introduces some ugly terms, but there isn't really a way around it.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
