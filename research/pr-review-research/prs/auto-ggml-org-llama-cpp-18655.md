# ggml-org/llama.cpp #18655 — webui: Agentic Loop + MCP Client with support for Tools, Resources and Prompts

**[View PR on GitHub](https://github.com/ggml-org/llama.cpp/pull/18655)**

| | |
|---|---|
| **Author** | @allozaur |
| **Status** | ✅ merged |
| **Opened** | 2026-01-07 |
| **Repo importance** | ★114,713 · 19,193 forks · score 196,483 |
| **Diff** | +15285 / −366 across 147 files |
| **Engagement** | 155 conversation · 232 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @ggerganov — 27 reactions  
`❤️ 7 · 🎉 5 · 🚀 6 · 😄 9`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/18655#issuecomment-4003267604)

> Hello from llama.cpp WebUI! Using the Github MCP Server to post this comment :smile:
> 
> <img width="947" height="1155" alt="image" src="https://github.com/user-attachments/assets/89dfced5-2b7b-469e-82ad-b8362a035595" />

### @allozaur — 13 reactions  
`👍 4 · ❤️ 5 · 🎉 2 · 🚀 2`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/18655#issuecomment-3728360488)

> > I'm interested in this, so gave the PR a look and just wanted to ask, are local MCP servers planned to be supported?
> > 
> > Right now it looks like URL is required, without a local "command" "args" "env" type option. (for Node, NPX / UVX, Docker, etc) Might be able to get around this with a MCP proxy server, but built-in support of local servers like many MCP clients would be welcomed.
> > 
> > e.g. Cursor, VS Code, OpenCode, Roo Code, Antigravity, LM Studio, and others support the following with small variations:
> > 
> > ```
> > {
> >   "mcpServers": {
> >     "git": {
> >       "command": "uvx",
> >       "args": ["mcp-server-git"]
> >     },
> >     "name": {
> >       "command": "npx",
> >       "args": [ "/path/index.js" ],
> >       "env": { "VAR": "VAL" }
> >     }   
> >   }
> > }
> > ```
> > 
> > Lots of [examples here](https://context7.com/docs/resources/all-clients).
> > 
> > I know it's still WIP, but just wanted to ask. Or maybe I've missed it?
> 
> Hey! We are introducing a solid basis for MCP support in llama.cpp, starting with pure WebUI implementation. We will add further enhancements in near future ;)

### @allozaur — 7 reactions  
`👍 3 · ❤️ 2 · 🚀 2`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/18655#issuecomment-3872891855)

> > Some day I'll see that notification pop up, and it'll be for a merge. 😆 
> > 
> > 
> > 
> > Appreciate the continued work.
> 
> I will make it ready for review and testing most probably tomorrow! 😉

### @allozaur — 7 reactions  
`👍 2 · ❤️ 1 · 🚀 1 · 👀 3`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/18655#issuecomment-3887748152)

> > @ggerganov i will add few demo videos to the PR description later today :)
> 
> @ggerganov I have uploaded the videos and added them to the description:
> 
> > ### Adding a new MCP Server and using it within an Agentic Loop
> >
> > https://github.com/user-attachments/assets/56a3016b-a444-413b-ab53-7fe175d73583
> >
> > ### Using MCP Prompts
> >
> > https://github.com/user-attachments/assets/afef81fd-f8ad-428b-8dd1-4796fa53c311
> >
> > ### Using MCP Resources
> >
> > https://github.com/user-attachments/assets/c0241d17-e2ba-4015-8c60-86907c0f4f2a
> >
> > ### Image Generation and Web Search using different MCP servers
> >
> > https://github.com/user-attachments/assets/62e82794-4306-45c3-8144-0bbb90383ee3

### @allozaur — 6 reactions  
`👍 2 · ❤️ 2 · 👀 2`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/18655#issuecomment-3765242071)

> Hey, all, thank you so much for testing and feedback. I will take a close look at all these remarks after the weekend and will make sure to have addressed them along the week. I'm currently working on completing the full MCP standard compatibility so that we have a really solid base to keep build on further. In the meantime, any tests and bug reports or suggestions are more than welcome!

### @allozaur — 6 reactions  
`🎉 3 · 🚀 3`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/18655#issuecomment-3879826350)

> > > > Some day I'll see that notification pop up, and it'll be for a merge. 😆
> > 
> > > > Appreciate the continued work.
> > 
> > > 
> > 
> > > I will make it ready for review and testing most probably tomorrow! 😉
> > 
> > 
> > 
> > thanks for the description (finally!) :) is it now ready for testing?
> 
> Yes, please do test it heavily!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
