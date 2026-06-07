# rails/rails #51674 — Add `Parameters#expect` to safely filter and require params

**[View PR on GitHub](https://github.com/rails/rails/pull/51674)**

| | |
|---|---|
| **Author** | @martinemde |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @MatheusRich
> I wonder if we should just handle these NoMethodErrors differently. It feels weird to return a 500 when the error is the 'the user's fault'. Maybe we could return a 4XX somehow?

### @MatheusRich
> Can you write tests for it and prefer using it to `require.permit` in the guides?

### @dari-us
> The fact of how permit works when applied to params 'root' means it would consider any other params to be unpermitted...The `fetch.permit` pattern could be `allow(user: [:name, :age])`

### @p8
> I'm wondering if `expect` is a little too close to `except`, and could cause confusion and typo's?

### @dhh
> Don't need to nag people about this. They can upgrade to the new syntax as they see fit and new apps will automatically guide folks in that direction.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
