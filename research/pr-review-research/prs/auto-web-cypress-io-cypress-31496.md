# cypress-io/cypress #31496 — feat: extend Cypress.Keyboard.Keys and cy.press to support (almost) all keyboard keys

**[View PR on GitHub](https://github.com/cypress-io/cypress/pull/31496)**

| | |
|---|---|
| **Author** | @jennifer-shehane |
| **Status** | Merged (August 28, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @brian-mann
> it seems like we aren't normalizing `cy.press()` to the same options/behavior/mechanics as `cy.type()` ... namely I can see in the code that we're always issuing the keydown + up events, instead of giving you the ability to 'press and hold' a particular key down before releasing it later.

### @adamalston
> Is there a reason not to narrow the parameter type to `KeyPressSupportedKeys`? That change would remove the need for the type assertion inside the function.

### @cacieprins
> `SupportedKey` is a bit of a weird type here. It needs to include: Named Keys, Single-codepoint utf-8 characters, Multi-codepoint utf-8 characters but exclude: Multiple characters.

### @AtofStryker
> likely need to bump the version to `15.1.0` in the changelog. I can do that in the release PR if needed

### @jennifer-shehane
> @cacieprins Oh, this seems like it should be handled better

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
