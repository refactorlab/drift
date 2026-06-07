# FlowiseAI/Flowise #5930 — feat: turn chatflow into MCP server

**[View PR on GitHub](https://github.com/FlowiseAI/Flowise/pull/5930)**

| | |
|---|---|
| **Author** | @prd-hoang-doan |
| **Status** | ✅ merged |
| **Opened** | 2026-03-08 |
| **Repo importance** | ★53,370 · 24,490 forks · score 156,317 |
| **Diff** | +2819 / −49 across 39 files |
| **Engagement** | 19 conversation · 25 inline review comments |

## Top review comments (ranked by reactions)

### @harshit-flowise — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/FlowiseAI/Flowise/pull/5930#issuecomment-4033866879)

> Thanks @prd-hoang-doan for this feature. I am reviewing and testing it. Will reach out to you with comments if needed.

### @jchui-wd — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/FlowiseAI/Flowise/pull/5930#issuecomment-4129853886)

> Hey @prd-hoang-doan, thanks for the PR! A few pieces of feedback below:
> 
> **1. Co-locate test files**
> 
> Move test files next to their source files per project convention — e.g. `src/services/mcp-server/index.test.ts` rather than a separate `test/` directory. Apply the same to controller and utils tests.
> 
> Can you also add tests for `mcp-server/endpoint.ts`, which will become `mcp-endpoints/index.ts` (see item 5).
> 
> **2. Add permission middleware to mcp-server routes**
> 
> The management routes (`GET/POST/PUT/DELETE` on `chatflows-mcp-server`) currently have no auth middleware. Add `checkAnyPermission` to each route, reusing the existing `chatflows:config` and `agentflows:config` permissions — same pattern as `routes/variables/index.ts` and `routes/chatflows/index.ts`.
> 
> **3. Move `IMcpServerConfig` into `src/Interface.ts`**
> 
> Server-side interfaces with the `I` prefix belong in `Interface.ts` alongside `IChatFlow`, `ITool`, etc. `IMcpServerConfig` is currently defined and exported from the service file — move it there.
> 
> **4. Use `useApi` hook in `McpServer.jsx`**
> 
> `getMcpServerConfig` is called directly in a raw async function inside `useEffect`. The convention is to use the `useApi` hook for all API calls, see `views/variables/index.jsx` or `views/chatflows/index.jsx` for the pattern. The current approach also silently swallows load errors.
> 
> **5. Move `services/mcp-server/endpoint.ts` → `services/mcp-endpoint/index.ts`** 
> 
> The live MCP protocol handling belongs in its own service folder to match the existing `routes/mcp-endpoint/` and `controllers/mcp-endpoint/` structure.
> 
> **6. Si … *[truncated]*

### @jchui-wd — 1 reactions  
`👍 1`  ·  [link](https://github.com/FlowiseAI/Flowise/pull/5930#issuecomment-4158763108)

> Thanks for the changes @prd-hoang-doan, just a few more things.
> 
> 1. Small change above on `mockRequest.test.ts`
> 2. Can there be a indicator when `getMcpServerConfigApi.error` fails, something like
>     ```
>     useEffect(() => {
>         if (getMcpServerConfigApi.error) {
>             showError(`Failed to load MCP Server config: ...`)
>         }
>     }, [getMcpServerConfigApi.error])
>     ```
>     McpServer.jsx.
> 3. nit: Just for consistency, can you rename `mcpServer.js` to be `mcpserver.js` in `/packages/ui/src/api/mcpServer.js`

### @prd-hoang-doan — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/FlowiseAI/Flowise/pull/5930#issuecomment-4163021618)

> @jchui-wd Thank you for pointing out the inconsistent implementation. I updated points 2 and 3. 
> What do you want for point 1?

### @HenryHengZJ — 1 reactions  
`🚀 1`  ·  [link](https://github.com/FlowiseAI/Flowise/pull/5930#issuecomment-4183018959)

> Note: we might also want to allow users store MCP server similar to Custom tools, but thats a separate story and PR https://github.com/orgs/FlowiseAI/projects/2?pane=issue&itemId=168148790

### @prd-hoang-doan — 1 reactions  
`🎉 1`  ·  [link](https://github.com/FlowiseAI/Flowise/pull/5930#issuecomment-4183091908)

> Thank you for your valuable feedback @HenryHengZJ @christopherholland-workday 
> I will follow up and fix these issues above.
> Besides, I found your new ticket about Custom MCP Server. If there is no one implementing it, I am happy to contribute that. This is in development right now. You can take a look at demo this and give me any feedback.
> 
> https://github.com/user-attachments/assets/5a688168-a45e-4fe2-b85c-ce2db5220d54
> 
> You can watch the full flow at Youtube: https://youtu.be/_sJ1MIRil4o


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
