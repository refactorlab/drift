# crossplane/crossplane #6909 — design: Add a design document for developer experience tooling

**[View PR on GitHub](https://github.com/crossplane/crossplane/pull/6909)**

| | |
|---|---|
| **Author** | @adamwg |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @tampakrap
> It is actually three phases (render, validate, assertion)...it would be nice to have setup (validation, copying to temp dirs), patching, pre-test/post-test hooks.

### @adamwg
> I'm totally open to making Python work more like Go, where what goes in the embedded function directory is a full function source tree...I'm not a big Python person myself, so I'd be interested in feedback from folks who do build in Python about what the ideal experience is here.

### @negz
> I think we landed on the `compose()` function signature with everything hidden away because some folks within Upbound's product team at the time felt strongly that this simpler UX was better - less intimidating.

### @tampakrap
> we need to make sure that we support most/all of the params of crossplane render/validate, not only for inputs but also for other interesting cases, eg to be able to configure if we want to fail on missing CRDs.

### @adamwg
> Separately from this work...we have been talking about a change to allow pipelines to refer to functions by OCI ref...potentially have the composition controller install the functions automatically.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
