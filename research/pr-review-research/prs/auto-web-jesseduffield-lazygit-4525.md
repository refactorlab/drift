# jesseduffield/lazygit #4525 — Clean up the configuration of where a custom command's output goes

**[View PR on GitHub](https://github.com/jesseduffield/lazygit/pull/4525)**

| | |
|---|---|
| **Author** | @stefanhaller |
| **Status** | Merged (May 5, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jesseduffield
> I think it's worth mentioning that 'log' will stream the output whereas 'popup' will only show the output after the command has finished

### @ChrisMcD1
> Is it worth defining these literals `log`, `popup`, `none` as a constant somewhere?

### @jesseduffield
> In the interest of backwards compatibility, what are your thoughts on migrating everybody who's currently on 'stream: true' to both 'output: log' and 'pty: true'?

### @stefanhaller
> My assumption is that people using `stream: true` did that because they wanted to see the output, not because they wanted to use a PTY...I think it makes sense to err on the side of what's probably best for most people

### @ChrisMcD1
> Should we add validation here that the user has not done `pty: true` with `subprocess: true`, or `output` not equal to `log`?

### @jesseduffield
> Just tested GPG signing manually...The fact I get prompted at all and can enter the values is reassuring though.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
