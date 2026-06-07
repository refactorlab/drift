# jupyterlab/jupyterlab #17363 — If subshells are supported by the kernel, send comm messages to subshells

**[View PR on GitHub](https://github.com/jupyterlab/jupyterlab/pull/17363)**

| | |
|---|---|
| **Author** | @martinRenou |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @krassowski
> I wonder if we could make it less disrupting for any downstreams which re-implement interfaces by making the additions optional.

### @ianthomas23
> I wonder if we should add the ability to check if a comm is using a subshell, and what the subshell ID is. I don't have a particular use case in mind, but I imagine it could be useful for debugging.

### @trungleduc
> Wondering if we should create a subshell per comm-target basis instead. Meaning, one subshell for all ipywidgets... is there any downside of this approach?

### @fleming79
> Because each subshell provides a different thread, it also has a different asyncio event loop... I'd recommend the default setting for 'Kernel Comms over subshells' is changed to 'Disabled' to avoid disturbing current users.

### @ianthomas23
> The inability of ipywidgets to support updates in the presence of a blocking task has been a bug for years, and is fixed by this PR.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
