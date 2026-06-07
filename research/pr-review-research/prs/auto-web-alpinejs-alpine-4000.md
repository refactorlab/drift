# alpinejs/alpine #4000 — feat: Update lifecycle and mutation

**[View PR on GitHub](https://github.com/alpinejs/alpine/pull/4000)**

| | |
|---|---|
| **Author** | @Matsa59 |
| **Status** | Merged (Feb 2, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ekwoka
> The sets would only fix an issue of Alpine trying to initialize the element twice. The concern in the original PR was that the element had both an add and a remove, but had never actually been initialized.

### @ekwoka
> Can you add a test to verify this works correctly? Ideally first make it not work (without your changes) and then validate your changes against it.

### @calebporzio
> I'm slightly hesitant to pull this in for some reason - maybe I'd prefer more of that code to live in the mutation handler? Idk.

### @calebporzio
> Thanks @Matsa59 - in the future please checkout a non-main branch to PR back to this repo.

### @PhiloNL
> It seems Alpine is no longer picking up any changes that happen after the initial render (using Livewire v2, in this example).

### @Matsa59
> If you add `x-data` on the `<div x-ref="resultGroups">` it should work.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
