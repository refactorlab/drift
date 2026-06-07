# bigskysoftware/htmx #3173 — Write title as innerText instead of innerHTML

**[View PR on GitHub](https://github.com/bigskysoftware/htmx/pull/3173)**

| | |
|---|---|
| **Author** | @emilhem |
| **Status** | Merged (Apr 24, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Telroshan
> I would maybe recommend `textContent` instead of `innerText`, as it's a property of `Node`...and doesn't trigger a reflow as opposed to `innerText`

### @Telroshan
> this kind of warning is kinda a lost cause regarding htmx as we support `eval` which is reported as dangerous by many scanners

### @geoffrey-eisenbarth
> as @Telroshan pointed out, this should still be `.innerText`, the type cast just makes it treat `titleElt` as an `HTMLElement`

### @emilhem
> Some security checks are grumpy when using innerHTML. Using innerText instead calms them.

### @lukewarlow
> One benefit to this change is it's one less usage of a Trusted Types sink that will need handling if HTMX ever wants to support running in Trusted Types enforced environments

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
