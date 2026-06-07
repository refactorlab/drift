# gradio-app/gradio #10984 — Let Gradio apps also be MCP Servers

**[View PR on GitHub](https://github.com/gradio-app/gradio/pull/10984)**

| | |
|---|---|
| **Author** | @abidlabs |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @freddyaboulton
> Tool description shows undefined if the parameter does not have a description in the docstring. We should be showing the same info in `/schema`, no?

### @freddyaboulton
> There is an issue when using multiple gradio apps as mcp servers at the same time in cursor...should we give our tools unique names (perhaps by prepending with the space id when available)?

### @freddyaboulton
> We should use the space-id here if available so that mcp serves have unique names for spaces.

### @freddyaboulton
> I think connect can be async if it's just just used in the connect button click event.

### @freddyaboulton
> I think it would be clearer if everything was async rather than mixing sync and async scopes via `loop.run_until_complete`.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
