# neovim/neovim #34846 — feat(api): nvim_echo can emit Progress messages/events

**[View PR on GitHub](https://github.com/neovim/neovim/pull/34846)**

| | |
|---|---|
| **Author** | @shadmansaleh |
| **Status** | ✅ merged |
| **Opened** | 2025-07-08 |
| **Repo** | curated review-culture seed |
| **Diff** | +648 / −19 across 19 files |
| **Engagement** | 25 conversation · 140 inline review comments |

## Top review comments (ranked by reactions)

### @luukvbaal — 2 reactions  
`👍 2`  ·  [link](https://github.com/neovim/neovim/pull/34846#issuecomment-3219902395)

> This PR is now seemingly storing the progress data in the message history without a valid reason. Can we please forego manipulating the message history for progress/ID messages prematurely? As far as I can tell this data is only emitted directly as a result an `nvim_echo()` call, so that data should be available as its arguments, not stored internally (https://github.com/neovim/neovim/pull/34846#discussion_r2195409882).

### @justinmk — 1 reactions  
`👍 1`  ·  [link](https://github.com/neovim/neovim/pull/34846#issuecomment-3066612792)

> 1. editor event (autocmd)
> 1. adding new args to an event is non-breaking (`:help api-contract`)
> 1. UI events are asynchronous and not related to any particular function. `nvim_echo` happens to affect the UI (it prints messages) so it generates UI events.
> 
> > should we make progress messages always to be recorded in history?
> 
> I was thinking about this today and starting to doubt some portion of my proposal. Because progress messages are long-lived, and when they are updated they generate messages, so it doesn't really make sense to "update" an existing message. That would make the message system logic very strange.
> 
> > when a message update comes should we drop the message node to end of history. Or modify in where it is.
> 
> yeah, that's the part I am rethinking. Pushing it to the end would increment the id...? But that makes no sense. And if it doesn't increment the id, then the message system has to reason about the order of messages.
> 
> > should we let progress percent to be decreased? Or allow it only to increase? In case of vscode they provide a increment option only.
> 
> Is it a reversible decision? If so, we can choose the simple way.
> 
> > also in your proposal what does status actually represent?
> 
> `status='done|fail|cancel|waiting|...'`

### @luukvbaal — 1 reactions  
`👍 1`  ·  [link](https://github.com/neovim/neovim/pull/34846#issuecomment-3066742989)

> Like I said, simply passing the ID to the msg_show event (emitted [here](https://github.com/neovim/neovim/blob/3e7f5d95aa25943e26d88a75fc55785229c36e34/src/nvim/message.c#L3183), modified [here](https://github.com/neovim/neovim/blob/3e7f5d95aa25943e26d88a75fc55785229c36e34/src/nvim/api/ui_events.in.h#L165)) would be sufficient for a UI to replace the message (adding status, title, percent, to the UI event still seems excessive to me). The UI itself would track whether it is still visible, doesn't need to be attached to the message history in `message.c`.

### @przepompownia — 1 reactions  
`👀 1`  ·  [link](https://github.com/neovim/neovim/pull/34846#issuecomment-3067088057)

> Will the `replace_last` parameter become redundant after providing message ids?

### @luukvbaal — 1 reactions  
`👍 1`  ·  [link](https://github.com/neovim/neovim/pull/34846#issuecomment-3067103202)

> > Not exactly. That takes care of `ext-ui` clients but the tui won't handle things just with that. Tui would just be printing the message as is.
> 
> Exactly, and that is what it will continue to do. I don't think it makes sense to add C code at this point to display/replace messages in the TUI. It will become a UI client.
> 
> ~~Adding additional arguments is fine, but maybe we should consider adding a `data` field rather than 4 new arguments.~~

### @luukvbaal — 1 reactions  
`👍 1`  ·  [link](https://github.com/neovim/neovim/pull/34846#issuecomment-3067626775)

> > Since it's not yet I think it makes sense to support the current tui. It's not a ton of code anyway.
> 
> That remains to be seen. I was talking about (re)placing a message with an ID in some special place other than the 'cmdheight' area. That's the only way this proposal makes any sense to me (and would be a couple lines of Lua code in vim._extui). The legacy message grid always replaces messages by definition after all, whether they have an ID or not. But maybe I'm missing the point here, I'll refrain from commenting until the proposal is more complete.
> 
> > Also, in the 1st casse it's already in an object
> 
> It's not for `vim.ui_attach` callbacks, but yes you're right for RPC notifications, so never mind this.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
