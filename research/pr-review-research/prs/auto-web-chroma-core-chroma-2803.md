# chroma-core/chroma #2803 — [PERF] Convert embeddings representation to numpy

**[View PR on GitHub](https://github.com/chroma-core/chroma/pull/2803)**

| | |
|---|---|
| **Author** | @drewkim |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @codetheweb
> not sure what this referencing; the profiling methodology included in a [Details] would be really helpful :)

### @atroyn
> Mostly nits; I am not sure we should be returning numpy arrays in the result returned to the user when embeddings are included but can be swayed either way.

### @atroyn
> I am not sure `numpy.typing.NDarray` is actually safe to use; I've run into issues with it before for some versions of numpy.

### @atroyn
> Before merging this PR, please: Review and respond to / resolve all open comments; Ensure pre-commit hooks are running and the type checker / linter is passing; Make the required docs changes

### @atroyn
> LGTM! Let's be sure to communicate API changes when we release.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
