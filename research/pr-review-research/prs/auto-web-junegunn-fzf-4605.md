# junegunn/fzf #4605 — Add fish completion support

**[View PR on GitHub](https://github.com/junegunn/fzf/pull/4605)**

| | |
|---|---|
| **Author** | @lalvarezt |
| **Status** | Merged (Feb 5, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @bitraid
> Having `**` as the default trigger, makes it no longer possible to insert every file of every directory in the command line, by simply typing `**<TAB>`.

### @bitraid
> The whole script could be much simpler. There is no need to manually set what to complete for each command, parse host files, get list of function/variable names, run `ps`, etc.

### @bitraid
> Selecting in fzf file/dir names containing newlines is still not addressed...Tokens that contain escaped whitespace characters are not preserved in query.

### @bitraid
> Instead of binding to `tab` and triggering on `**`...bind to `shift-tab` and replace the search-mode completion of fish...provides enhanced functionality: more filtering options, multiple selections, full descriptions text.

### @junegunn
> I hope the fish completion aligns with the existing ones, particularly in terms of configuration. You may want to update the README and extend the existing integration tests to cover fish.

### @junegunn
> This PR has been open for so long with too many comments, making it difficult for others to track the progress.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
