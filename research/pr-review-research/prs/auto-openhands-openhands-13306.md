# OpenHands/OpenHands #13306 — settings: expose SDK settings schema to OpenHands

**[View PR on GitHub](https://github.com/OpenHands/OpenHands/pull/13306)**

| | |
|---|---|
| **Author** | @neubig |
| **Status** | ✅ merged |
| **Opened** | 2026-03-08 |
| **Repo importance** | ★75,896 · 9,635 forks · score 119,434 |
| **Diff** | +13684 / −6860 across 151 files |
| **Engagement** | 94 conversation · 161 inline review comments |

## Top review comments (ranked by reactions)

### @neubig — 1 reactions  
`👀 1`  ·  [link](https://github.com/OpenHands/OpenHands/pull/13306#issuecomment-4055012341)

> @openhands merge main and fix conflicts
> 
> then update the code in this PR to reflect the most recent changes here: https://github.com/OpenHands/software-agent-sdk/pull/2361
> 
> respond with instructions about how I can test this locally

### @neubig — 1 reactions  
`👀 1`  ·  [link](https://github.com/OpenHands/OpenHands/pull/13306#issuecomment-4063735211)

> @openhands merge main and fix failing CI

### @neubig — 1 reactions  
`👀 1`  ·  [link](https://github.com/OpenHands/OpenHands/pull/13306#issuecomment-4069497531)

> @openhands merge main and fix any issues. make sure that this runs appropriately.

### @neubig — 1 reactions  
`👀 1`  ·  [link](https://github.com/OpenHands/OpenHands/pull/13306#issuecomment-4082200402)

> @openhands When I try to save settings I got
> 
> ```
> INFO:     127.0.0.1:49930 - "GET /api/v1/web-client/config HTTP/1.1" 200 OK
> INFO:     127.0.0.1:49935 - "GET /api/v1/web-client/config HTTP/1.1" 200 OK
> 08:34:25 - openhands:INFO: utils.py:159 - config.toml not found: [Errno 2] No such file or directory: 'config.toml'. Toml values have not been applied.
> INFO:     127.0.0.1:49936 - "GET /api/settings HTTP/1.1" 200 OK
> INFO:     127.0.0.1:49937 - "GET /api/conversations?limit=10 HTTP/1.1" 200 OK
> INFO:     127.0.0.1:49941 - "GET /api/options/models HTTP/1.1" 200 OK
> INFO:     127.0.0.1:49942 - "GET /api/options/agents HTTP/1.1" 200 OK
> INFO:     127.0.0.1:49943 - "GET /api/options/security-analyzers HTTP/1.1" 200 OK
> 08:34:58 - openhands:WARNING: settings.py:319 - Something went wrong storing settings: 1 validation error for Settings
> secrets_store
>   Field is frozen [type=frozen_field, input_value={'provider_tokens': {}}, input_type=dict]
>     For further information visit https://errors.pydantic.dev/2.12/v/frozen_field
> INFO:     127.0.0.1:49948 - "POST /api/settings HTTP/1.1" 500 Internal Server Error
> ```
> 
> Fix the error, push to the appropriate PR, and make sure that saving LLM settings works through the UI by writing playwright scripts to press the appropriate button, and running them in the background.
> 
> Once you make sure of that, make sure also that CI passes

### @neubig — 1 reactions  
`👀 1`  ·  [link](https://github.com/OpenHands/OpenHands/pull/13306#issuecomment-4082777406)

> @openhands
> Merge main
> 
> Then, I want you to fix a bug. When I try to save settings I got
> 
> INFO:     127.0.0.1:49930 - "GET /api/v1/web-client/config HTTP/1.1" 200 OK
> INFO:     127.0.0.1:49935 - "GET /api/v1/web-client/config HTTP/1.1" 200 OK
> 08:34:25 - openhands:INFO: utils.py:159 - config.toml not found: [Errno 2] No such file or directory: 'config.toml'. Toml values have not been applied.
> INFO:     127.0.0.1:49936 - "GET /api/settings HTTP/1.1" 200 OK
> INFO:     127.0.0.1:49937 - "GET /api/conversations?limit=10 HTTP/1.1" 200 OK
> INFO:     127.0.0.1:49941 - "GET /api/options/models HTTP/1.1" 200 OK
> INFO:     127.0.0.1:49942 - "GET /api/options/agents HTTP/1.1" 200 OK
> INFO:     127.0.0.1:49943 - "GET /api/options/security-analyzers HTTP/1.1" 200 OK
> 08:34:58 - openhands:WARNING: settings.py:319 - Something went wrong storing settings: 1 validation error for Settings
> secrets_store
>   Field is frozen [type=frozen_field, input_value={'provider_tokens': {}}, input_type=dict]
>     For further information visit https://errors.pydantic.dev/2.12/v/frozen_field
> INFO:     127.0.0.1:49948 - "POST /api/settings HTTP/1.1" 500 Internal Server Error
> Fix the error, push to the appropriate PR, and make sure that saving LLM settings works through the UI by writing playwright scripts to press the appropriate button, and running them in the background.
> 
> Once you make sure of that, make sure also that CI passes

### @neubig — 1 reactions  
`👀 1`  ·  [link](https://github.com/OpenHands/OpenHands/pull/13306#issuecomment-4139994452)

> @openhands fix merge conflicts and make sure that CI passes, then update the SHA on the corresponding deploy repo PR to re-deploy, and make sure that the deploy also passes. when monitoring CI, remember that if you use gh watch it will time out, so you should just sleep for 5 minutes and check manually while waiting


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
