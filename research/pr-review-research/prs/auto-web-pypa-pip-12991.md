# pypa/pip #12991 — Introduce resumable downloads with --resume-retries

**[View PR on GitHub](https://github.com/pypa/pip/pull/12991)**

| | |
|---|---|
| **Author** | @gmargaritis |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @notatallshaw
> A pip maintainer needs to take up the task of reviewing it, as we're all volunteers it's a matter of finding time. I think my main concern would be the behavior when interacting with index servers that behave badly, e.g. give the wrong content length (usually 0).

### @ichard26
> The sticking point I have is that I'm still not sure of the UI of resumable downloads. `--resume-retries` is a weird flag...it's likely to be rather obtuse for users.

### @notatallshaw
> Firstly, I really dislike changing how features are enabled between pip versions, it makes guides outdated quickly...Secondly, I mildly dislike overloading flag with multiple meanings...

### @pfmoore
> The PR looks good, although I'm not a http expert so I can't comment on details like status and header handling. Like @notatallshaw I wish we could leave this sort of detail to a 3rd party library...

### @notatallshaw
> Running: `pip install --dry-run --no-cache torch --resume-retries 4`...the total goes down each time to the amount remaining on each try but the progress is the amount of progress across all tries.

### @ichard26
> Once we get feedback and confirm that this feature is working out in the wild, we can flip the default number of resume retries to a non-zero value...no extra changes are needed.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
