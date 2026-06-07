# nushell/nushell #16859 — Plugin: support custom completions in command flags

**[View PR on GitHub](https://github.com/nushell/nushell/pull/16859)**

| | |
|---|---|
| **Author** | @WindSoilder |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @blindFS
> Hmm, I just realized that get_dynamic_completion doesn't get the buffer. Sorry to keep holding up this PR, but I think it'd be better if it also accepted the buffer/text typed by the user.

### @cptpiepmatz
> While reviewing this I wondered why this is even needed. We have custom completions for externals...I don't understand why we cannot use that in some smart way. Is it not dynamic or what is the issue here?

### @WindSoilder
> The main issue is that it's hard to get the internal state of a plugin, it may take a lot of effort to expose commands to query internal state.

### @cptpiepmatz
> I see the issue. But how are the other completers implemented? Both feel to me as they try to solve very similar issues. Should we merge these two ideas?

### @ysthakur
> The way custom completions work right now...there is no such `DeclId` available. So `Command`s can't use this existing mechanism to provide dynamic completions at the moment.

### @blindFS
> Actually @cptpiepmatz made me thinking that maybe it could/should be done at the `Parameter` level, instead of `Command`.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
