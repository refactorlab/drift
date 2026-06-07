# hashicorp/vault #29047 — Allow Configuration of Azure Secret Engine, including WIF for enterprise users

**[View PR on GitHub](https://github.com/hashicorp/vault/pull/29047)**

| | |
|---|---|
| **Author** | @Monkeychip |
| **Status** | Merged (December 18, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @hellobontempo
> This seems like quite a bit of extra code (these two getters plus the `formFieldGroups` function below) - I think we already have helpers that do this 🤔 Can we reuse any of the model decorators or existing patterns to get the same functionality?

### @hellobontempo
> Since this is reused in AWS curious why we didn't make a shared component?

### @hellobontempo
> Noelle had a great idea that instead of using `assert` here (which can be kind of confusing and unclear) we can throw an error...

### @hellobontempo
> FWIW I don't _think_ this would happen if you didn't create a new record, and reused the record from `queryRecord`. But I'm not 💯 sure

### @hellobontempo
> Personally I don't think we need to hold onto `queryIssuerError` here and could just always say 'if it exists' but that's just me in favor of keeping things simple 😅

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
