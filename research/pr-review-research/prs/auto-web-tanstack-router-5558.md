# TanStack/router #5558 — test(solid-start): basic-auth e2e suite and example

**[View PR on GitHub](https://github.com/TanStack/router/pull/5558)**

| | |
|---|---|
| **Author** | @birkskyum |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

*Note: Substantive review feedback on this PR came from the @coderabbitai review bot rather than human maintainers. Although bot comments are normally ignored, no human prose was present in the conversation; the bot's flagged issues are recorded below verbatim because they capture the actual review substance of this PR.*

### @coderabbitai (bot)
> .env un-ignoring risks committing secrets. Replace negate rule with ignores and keep only an example file tracked.

### @coderabbitai (bot)
> Tests never run: `exit 0` short-circuits the e2e script. Remove it so Playwright actually executes.

### @coderabbitai (bot)
> Use `workspace:*` for internal deps (per repo guidelines). Align all internal TanStack packages to `workspace:*`.

### @coderabbitai (bot)
> Fix `onSubmit` typing and pass the form element (strict mode). Prop type promises an `HTMLFormElement` but you pass the event.

### @coderabbitai (bot)
> Redundant unique index on primary key column. The `User_email_key` unique index is redundant since `email` is already PRIMARY KEY.

### @coderabbitai (bot)
> Remove generated test result artifacts. This file should not be committed; it's a generated test failure artifact.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
