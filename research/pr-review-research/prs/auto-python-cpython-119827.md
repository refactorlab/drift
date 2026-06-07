# python/cpython #119827 — gh-119127: functools.partial placeholders

**[View PR on GitHub](https://github.com/python/cpython/pull/119827)**

| | |
|---|---|
| **Author** | @dg-pb |
| **Status** | ✅ merged |
| **Opened** | 2024-05-31 |
| **Repo importance** | ★73,094 · 34,706 forks · score 216,918 |
| **Diff** | +681 / −129 across 8 files |
| **Engagement** | 61 conversation · 222 inline review comments |

## Top review comments (ranked by reactions)

### @serhiy-storchaka — 3 reactions  
`👍 3`  ·  [link](https://github.com/python/cpython/pull/119827#issuecomment-2190742859)

> Adding `__get__` to `partial` is a breaking change. It should be a separate issue and we should follow the common protocol for such changes: emit `FutureWarning` for few releases with suggestion to wrap `partial` into `staticmethod`, then change the behavior.
> 
> As for `__repr__`, I mean that it is better to fix it before merging this PR. This change could be backported.
> 
> We should not change `pickle` for `Placeholder`. It is not special enough, no other singleton except few builtins which are very special deserve this (and even for the latters there is now more general solution).

### @rhettinger — 3 reactions  
`👍 1 · 🎉 2`  ·  [link](https://github.com/python/cpython/pull/119827#issuecomment-2375817837)

> @dg-pb Congratulations on landing a new feature.

### @serhiy-storchaka — 2 reactions  
`👍 2`  ·  [link](https://github.com/python/cpython/pull/119827#issuecomment-2192200966)

> > 1. Serializing type via exposing `PlaceholderType`?
> 
> It does not matter. Write the simplest code. Whether it will be serializable or not does not matter. This is an insignificant implementation detail.
> 
> > 3\. 3.1. Should it be private or public? (Note, if private, then it will negatively impact repr string: `repr(type(Placeholder)) == "<class '_PlaceholderType'>"`
> 
> Do not make it public until you have a reason. Introspection allows you to see non-public classes, but this is not a reason to make them public.
> 
> > 3\. 3.2. Should it live in `functools` or `types`? Or somewhere else?
> 
> `types` is for builtin types not exposed in `builtins` and for some `type`-related utilities. It has nothing to do with `functools`.

### @rhettinger — 2 reactions  
`👍 2`  ·  [link](https://github.com/python/cpython/pull/119827#issuecomment-2197738240)

> Let's not get side-tracked on style issues.  They can be a real headache because new devs seems to want to rewrite everything the see and want their style to trump that of previous developers who may have had good reason for what they've done or who want the code to remain familiar to them.   They can be also be an irritant because the edits can introduce minor unintended changes in behavior or performance (somethings we use less functional code because that is more performant on PyPy for example).  Generally we don't do whitespace edits unless we're the primary maintainer of the entire module.

### @picnixz — 1 reactions  
`👍 1`  ·  [link](https://github.com/python/cpython/pull/119827#issuecomment-2155989979)

> If this renders like that, I think you can ignore my comments on the uppercasing then. Nonetheless, you should definitely document the new sentinel in the `functools` module, the same way it is done for `None` (I assume).

### @picnixz — 1 reactions  
`👍 1`  ·  [link](https://github.com/python/cpython/pull/119827#issuecomment-2172559069)

> > predicate = itl.partial(isinstance, Placeholder, str)
> 
> Actually, all the "good" usecases, IMO, boil down to a *right* partialization instead of a left partialization as I said in https://github.com/python/cpython/issues/119127#issuecomment-2155982139.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
