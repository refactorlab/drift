# pandas-dev/pandas #58551 — PDEP-14: Dedicated string data type for pandas 3.0

**[View PR on GitHub](https://github.com/pandas-dev/pandas/pull/58551)**

| | |
|---|---|
| **Author** | @jorisvandenbossche |
| **Status** | ✅ merged |
| **Opened** | 2024-05-03 |
| **Repo importance** | ★48,910 · 19,993 forks · score 133,847 |
| **Diff** | +375 / −0 across 1 files |
| **Engagement** | 48 conversation · 212 inline review comments |

## Top review comments (ranked by reactions)

### @jorisvandenbossche — 3 reactions  
`👍 3`  ·  [link](https://github.com/pandas-dev/pandas/pull/58551#issuecomment-2120484638)

> Thanks all for the feedback. 
> Pushed another update with minor text updates addressing some comments, and specifically added the suggestion to add a capitalized `"String"` alias to make the change for users that want to keep using the NA-variant smaller (`dtype="string"` to `dtype="String"` instead of `dtype="pd.StringDtype(na_value=pd.NA)"`), and that indeed makes it consistent with how we capitalize the string aliases for other nullable dtypes as well at the moment.
> 
> > Happy to discuss nullable dtypes by default for the 2025 major release. Though in particular I'm curious about your (Joris') thoughts on whether you'd eventually be happy making PyArrow required if PyArrow dtypes were the default wherever possible
> 
> @MarcoGorelli Interesting question, but let's leave that for another thread to answer that ;) (this one is already long enough)
> 
> @simonjayhawkins summary of my response to your comment (https://github.com/pandas-dev/pandas/pull/58551#issuecomment-2108192398):
> 
> - I don't think there good reason to believe most users (that would benefit from it) already use the string dtype, especially not for the pyarrow-backed version.
> - I don't think we are even considering making numpy 2.0 a requirement for pandas 3.0, so any more concrete discussion related to that is out of scope for this PDEP (see also my answer to Kevin's comment from 2 weeks ago: https://github.com/pandas-dev/pandas/pull/58551#discussion_r1589427303)
> 
> Will put my more detailed response I started to write up in a collapsed section, to reduce the wall of text a bit when scrolling through this PR. <details> … *[truncated]*

### @jbrockmendel — 2 reactions  
`👍 2`  ·  [link](https://github.com/pandas-dev/pandas/pull/58551#issuecomment-2148023019)

> > What are other people's thoughts on using "str" and "string" instead of
> > "string" and "String" as the string aliases for the dtype (for the NaN and
> > NA variant, respectively) ?
> 
> "str"/"string" seems much worse confusion-wise than "string"/"String".

### @jorisvandenbossche — 2 reactions  
`👍 2`  ·  [link](https://github.com/pandas-dev/pandas/pull/58551#issuecomment-2148511183)

> > Continuing to map (`dtype=str`) that to object when we have a more proper string implementation doesn't make sense to me.
> 
> To be clear, even if we would eventually go with `dtype="string"` for the default dtype anyways (i.e. the current state of the PDEP text in this PR), I think we should map `dtype=str` to mean the default string dtype, instead of object dtype. Because `dtype=str` currently indeed means "give me string data" (just using object dtype, because that's how it works), and we should keep that meaning but using the proper dtype when it is available. 
> The same is probably true for any other alias we currently map to "ensure string data in object dtype"? So that also includes things like `"str"`, `"U"`, `np.str_`. This is essentially just the same as we map `dtype=int` to the default int64 dtype (and not to object dtype with python integers)
> 
> (this is not actually implemented right now like that when enabling the future behaviour with `pd.options.future.infer_string = True`, but I would consider that as a missing piece in the implementation and had been planning to open an issue/PR for it)

### @jorisvandenbossche — 1 reactions  
`👍 1`  ·  [link](https://github.com/pandas-dev/pandas/pull/58551#issuecomment-2098185956)

> One of the concrete discussion points is the API design of the `StringDtype(..)` constructor and the way to distinguish the various variants of the dtype (i.e. the current `"pyarrow_numpy"` naming we introduced in https://github.com/pandas-dev/pandas/pull/54533 / https://github.com/pandas-dev/pandas/issues/54792).  
> To keep that sub-discussion manageable, I opened a dedicated issue for that specific topic: https://github.com/pandas-dev/pandas/issues/58613

### @jbrockmendel — 1 reactions  
`👍 1`  ·  [link](https://github.com/pandas-dev/pandas/pull/58551#issuecomment-2098592291)

> I'm with Joris pretty much across the board on this.  I'm pretty sure @phofl will be too.

### @jorisvandenbossche — 1 reactions  
`👍 1`  ·  [link](https://github.com/pandas-dev/pandas/pull/58551#issuecomment-2099132710)

> Thanks Brock. It would indeed be good to hear from others that previously seemed to be OK with the compromise and the NaN behaviour we currently have on main (or not OK, of course, in that case you are also allowed to speak up ;))


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
