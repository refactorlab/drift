# sharkdp/bat #3432 — make --help and -h use pager

**[View PR on GitHub](https://github.com/sharkdp/bat/pull/3432)**

| | |
|---|---|
| **Author** | @MuntasirSZN |
| **Status** | Not merged (commits were force-pushed away by pull[bot]) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @keith-hall
> A couple of questions - does it honor `--paging=never` on the command line and in the config file(s)? And does/can the help display keep the original colors from clap, or should it apply our help syntax highlighting?

### @keith-hall
> Yep, that should do the trick 👍 once done, it will be useful to compare the output highlighted from clap and this one, so please post a before and after screenshot 🙂 Also, I think we should support when the user requests to skip the pager (and colors), especially if someone wants to pipe the output to a file or into another program

### @keith-hall
> Do I understand correctly that it only takes config from the command line? Likely the recent changes in #3414 have complicated this, but it would be nice to share the same code/logic as the 'normal' path, and get config from `BAT_PAGER`,`PAGER` and other environment variables etc. as a fallback

### @keith-hall
> In my testing, it seems to ignore the `--theme` option, and always uses the default theme. i.e. `bat --theme=TwoDark --help` gives the same output as `bat --theme=ansi --help`, which is unexpected

### @keith-hall
> I notice it currently doesn't respect the theme from the config file or `BAT_THEME` env var, which would be nice to have working... This is kind of what I meant, that it would be easier to maintain if we didn't have to special-case everything for help

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
