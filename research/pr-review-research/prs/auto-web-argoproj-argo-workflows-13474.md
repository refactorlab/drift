# argoproj/argo-workflows #13474 — feat(cron): cronworkflows `when` clause

**[View PR on GitHub](https://github.com/argoproj/argo-workflows/pull/13474)**

| | |
|---|---|
| **Author** | @isubasinghe |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Joibel
> This needs documenting, with examples and the variables we can use.

### @agilgur5
> I wouldn't release a new field that uses a deprecated library and itself will be shortly deprecated.

### @terrytangyuan
> It's okay to use govaluate for new feature even if it will be deprecated in the future...syntax is familiar to existing users.

### @agilgur5
> `govaluate` is used in a _single_ place, `when`, whereas every other usage of expressions uses `expr`.

### @agilgur5
> Should the templating syntax and docs here be unified with `stopStrategy`...variables there may make sense to prefix with `cronworkflow.`

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
