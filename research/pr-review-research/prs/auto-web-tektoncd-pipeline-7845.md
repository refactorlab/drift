# tektoncd/pipeline #7845 — TEP-0154: Enable concise resolver syntax - stage 1

**[View PR on GitHub](https://github.com/tektoncd/pipeline/pull/7845)**

| | |
|---|---|
| **Author** | @chitrangpatel |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @JeromeJu
> nit: `validateRef` looks more likely to be in `taskref_validation` than `container_validation`

### @chitrangpatel
> This is for validating the StepAction Ref. I think that's in container validation. There is a separate `validateTaskRef` which is in taskref validation.

### @JeromeJu
> maybe as you pointed explicitly name it as `validateStepActionRef` might untangle this?

### @chitrangpatel
> It's tied to validating the ref. The field name for StepAction Ref is `ref`. That's why I went with `validateRef`...

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
