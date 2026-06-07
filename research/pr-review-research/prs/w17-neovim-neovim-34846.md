# neovim/neovim #34846 — feat(api): nvim_echo can emit Progress messages/events

**[View PR on GitHub](https://github.com/neovim/neovim/pull/34846)**

| | |
|---|---|
| **Author** | @shadmansaleh |
| **Status** | ✅ merged (2025-08-26) · 🚀5 👀2 |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> Keep the right concern at the right layer — `justinmk` insists UIs shouldn't need to know how to present progress — and prefer an extensible `data` field over four new positional arguments.

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@justinmk:**
> We need the new kind=progress to trigger the Progress event, but we don't need the progress items in the msg_show UI event. UIs don't/shouldn't need to care about how to present progress-messages.

**@luukvbaal:**
> Adding additional arguments is fine, but maybe we should consider adding a data field rather than 4 new arguments.

**@justinmk:**
> Does that mean a nvim_echo caller can set an arbitrary (string) message-id and if that id doesn't exist, it will create a new message with that id? This doesn't seem to be called out in the docs.

**@shadmansaleh:**
> Generated ids are always higher than last highest msg-id used... we are doing crude collision avoidance without requiring to store all already generated ids somewhere.


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
