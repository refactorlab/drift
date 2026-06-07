# ocornut/imgui #7925 — Add native UTF8 support for InputText and remove ImWchar buffer

**[View PR on GitHub](https://github.com/ocornut/imgui/pull/7925)**

| | |
|---|---|
| **Author** | @alektron |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ocornut
> Couldn't IMSTB_TEXTEDIT_GETPREVCHARINDEX_IMPL() simply use ImTextFindPreviousUtf8Codepoint()? much less code and likely faster.

### @ocornut
> The part about needing to run before TextW is rewritten is essentially broken now...Solving this the same way would annoyingly require us to make a copy of the full text before running the callback.

### @alektron
> Correct me if I'm wrong but we have been copying/converting on every frame before as well, right?...if we are not worse than before I'm almost tempted to go with plan C for now.

### @ocornut
> Quick test pasting a ~900 KB file, VS2022 x64 Debug Mode: BEFORE large, top ~3.65 ms...BRANCH AFTER LAST COMMIT large, top ~0.87 ms...This quite good.

### @ocornut
> I luckily noticed it because it broke the memory editor which used callback_data.SelectionEnd.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
