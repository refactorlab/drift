# OpenBB-finance/OpenBB #7094 — [Feature] Add `mcp_server` to `openbb_core` api

**[View PR on GitHub](https://github.com/OpenBB-finance/OpenBB/pull/7094)**

| | |
|---|---|
| **Author** | @MagnusS0 |
| **Status** | ✅ merged |
| **Opened** | 2025-04-20 |
| **Repo importance** | ★68,650 · 6,924 forks · score 101,321 |
| **Diff** | +3229 / −0 across 15 files |
| **Engagement** | 30 conversation · 3 inline review comments |

## Top review comments (ranked by reactions)

### @MagnusS0 — 4 reactions  
`❤️ 4`  ·  [link](https://github.com/OpenBB-finance/OpenBB/pull/7094#issuecomment-2978317126)

> Hey @piiq 
> 
> Thanks for looking through this!
> 
> Agree on migrating to use [FastMCP](https://github.com/jlowin/fastmcp). Started looking into it after @deeleeramone mentioned it. More active and follows MCP standards more closely. It also supports Prompt templates and Resources which there might be some cool use-cases for. 
> 
> I started on a rewrite today, but have to figure out how to implement the "management" tools, aka how to hot-swap tools at runtime without restarting the server. Any ideas here would be very helpful. It is supposed to be possible based on the original documentation (https://modelcontextprotocol.io/docs/concepts/tools#python)
> 
> I'll make sure to also move the configs and switch to `argparse` before pushing an update 🚀

### @MagnusS0 — 4 reactions  
`❤️ 3 · 🚀 1`  ·  [link](https://github.com/OpenBB-finance/OpenBB/pull/7094#issuecomment-3017283221)

> Got it working by setting `stateless_http=True`

### @MagnusS0 — 2 reactions  
`🚀 2`  ·  [link](https://github.com/OpenBB-finance/OpenBB/pull/7094#issuecomment-2849297837)

> Just an update on this, I have a master thesis to deliver in 10 days so will probably not contribute anything before after that. In case someone else wants to give it a go 🚀

### @MagnusS0 — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/OpenBB-finance/OpenBB/pull/7094#issuecomment-3008780383)

> Okey so fully refactored to use FastMCP 2.0! Streamable HTTP is now supported in addition to SSE and stdio. Also future support for Resources and PrompTemplates when clients start supporting it.
> 
> For multiple users it can be run with the discovery tools disabled, then the tools are set, so no dynamic changes. Then you can either limit the number of tools at startup or manually enable/disable e.g. in Cursor or Claud Desktop.
> 
> There is also no longer a problem with shutting it down when clients are connected. And settings has been integrated in the extension and swapped to `argparse`
> 
> Next is to implement unit tests, and probably look into authentication

### @deeleeramone — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/OpenBB-finance/OpenBB/pull/7094#issuecomment-2817410214)

> Thanks for the PR, @MagnusS0, and great idea!
> 
> Can you look at incorporating this, either as an extra [here](https://github.com/OpenBB-finance/OpenBB/tree/develop/openbb_platform/extensions/platform_api), as a keyword argument in the `openbb-api` command line launcher; or, as a standalone extension with a dedicated launcher?
> 
> A similar pattern can be established where the FastAPI instance is being imported from `openbb-core`,  ultimately using `uvicorn` to target that specific instance for starting the server.
> 
> Some degree of separation is going to be desirable and we'll need to expose the complete configurations for this server somewhere, potentially under, "system_settings:mcp_settings". The `system_settings.json` file can be read by the specific implementation at runtime and these definitions will not impact the main application.
> 
> BTW this, `system_service.system_settings.python_settings.docstring_max_length = 1024`, won't actually do anything as that only affects the Python docstrings, which is a completely independent from the API interface.

### @piiq — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/OpenBB-finance/OpenBB/pull/7094#issuecomment-2817863678)

> Hi @MagnusS0 this indeed _is_ a nice addition. I can only second @deeleeramone that it would be better if this is a standalone extension or a part of the `openbb-platform-api`. If the latter I personally would prefer that it will have it's own launch command like `openbb-mcp` similarly to how `openbb-api` is defined [here](https://github.com/OpenBB-finance/OpenBB/blob/b991baa861b75fa011003d60ee68e1671ced561c/openbb_platform/extensions/platform_api/pyproject.toml#L14). If the former feel free to create a folder in `openbb_platform/extensions`. 
> 
> I've taken a look at the fastapi-mcp package and apart from the mcp itself it does not seem to pull any new dependencies (which is a good thing)
> 
> Regarding the problem of the server not shutting down - I thing it is going to be best to debug this once we separate the mcp from the openbb_core codebase. It would make it easier to focus.
> 
> Thanks for the PR and let us know if you need any guidance


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
