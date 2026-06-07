# numpy/numpy #29129 — ENH: add a casting option 'same_value' and use it in np.astype

**[View PR on GitHub](https://github.com/numpy/numpy/pull/29129)**

| | |
|---|---|
| **Author** | @mattip |
| **Status** | Merged (September 17, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @seberg
> I think making it work everywhere is not nearly as hard as it may seem and so I think we have to at least try... I think the only good way to do this is that the new cast level(s) are reported by the loops (via `resolve_descriptors`) and integrated into `PyArray_MinCastSafety`.

### @seberg
> Unless we go all out and say that a `same_value` cast must also be a `same_kind` one and disallow float to integer casts entirely here... the float must clearly be an integer.

### @seberg
> Unless @mhvk/someone speaks up very soon about concerns, please go ahead and merge when you are happy [@mattip]

### @mhvk
> Don't really have the time for another review... you addressed all my more immediate comments. Please do raise follow-up issues about things not done, such as the various casting flags and how they are used and passed on.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
