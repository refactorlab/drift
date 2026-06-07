# oxc-project/oxc #15861 — feat(linter/plugins): Token-related `SourceCode` APIs (TS ESLint implementation)

**[View PR on GitHub](https://github.com/oxc-project/oxc/pull/15861)**

| | |
|---|---|
| **Author** | @lilnasy |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @overlookmotel
> We concluded in the end to keep all the deprecated methods, to maximize compatibility with older plugins, which may take some time to get updated

### @overlookmotel
> We should ideally lazy-load `@typescript-eslint/typescript-estree` package only when `getTokens` is first called.

### @overlookmotel
> I assume TS-ESLint's parser also generates a `ScopeManager`. If it does, we may as well cache it, to avoid running scope analysis again

### @overlookmotel
> they are going to both change and align soon, we should update our range calculation to match when they do.

### @overlookmotel
> Once we're happy with `getTokens` impl, I think we should merge this, and we can add more methods in separate PRs.

### @lilnasy
> `@typescript-eslint/parser` does. `@typescript-eslint/typescript-estree` does not...I decided to use the latter directly to instantiate scope managers and parsers granularly.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
