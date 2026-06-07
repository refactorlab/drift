# gradio-app/gradio #11712 — Publish `gr.Dataframe` as standalone library

**[View PR on GitHub](https://github.com/gradio-app/gradio/pull/11712)**

| | |
|---|---|
| **Author** | @hannahblair |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @pngwn
> They aren't actually doing anything (and are actually increasing the install size)...I think we should probably keep the checkbox listed as a dependency to ensure it doesn't break custom components.

### @pngwn
> The CSS variable looks like our existing vars, defaults being set through indirection which doesn't serve a purpose in the context of the dataframe.

### @pngwn
> This would give a clean and explicit user facing API...provide a fallback if nothing is provided.

### @abidlabs
> Property 'metadata' is missing in type...We should make `metadata` optional?

### @abidlabs
> The checkbox color for a boolean column type isn't matching the other colors (blue vs. orange).

### @pngwn
> Tested thoroughly and everything looks great!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
