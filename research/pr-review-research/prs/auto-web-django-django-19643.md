# django/django #19643 — Fixed #36410 -- Added named template partials to DTL

**[View PR on GitHub](https://github.com/django/django/pull/19643)**

| | |
|---|---|
| **Author** | @FarhanAliRaza |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @nessita
> I think that the partial name used for testing could be `partial-name` or `testing-name` to signal clearly to readers that this is a name identifier.

### @carltongibson
> I don't think that's right: Partials are being added to the Django Backend, not the backend agnostic template functionality per se.

### @ngnpope
> This is shaping up to be very nice and feels like it'll provide a lot of power with very little code to implement it

### @nessita
> I tried to model a test after this and is close but it needs tweaks to fully mimic a real scenario

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
