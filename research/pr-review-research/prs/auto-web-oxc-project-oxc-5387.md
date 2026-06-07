# oxc-project/oxc #5387 — feat(transformer): support all /regex/ to `new RegExp` transforms

**[View PR on GitHub](https://github.com/oxc-project/oxc/pull/5387)**

| | |
|---|---|
| **Author** | @Dunqing |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Boshen
> How are these turned on or off from `targets`?

### @overlookmotel
> Where I see `.into()` I often find myself wondering 'but into _what_?'

### @overlookmotel
> I've pushed a few commits...feel free to revert them if you don't like them

### @Dunqing
> Well, parsing RegExp increases the performance regression from 6% to 13%

### @rzvxa
> Yes, I'll take a look. I'm having a hunch as to what it might be

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
