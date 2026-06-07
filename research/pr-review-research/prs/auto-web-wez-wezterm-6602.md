# wez/wezterm #6602 — feat: Tmux control mode

**[View PR on GitHub](https://github.com/wez/wezterm/pull/6602)**

| | |
|---|---|
| **Author** | @joexue |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @joexue
> Complete the unfinished tmux control mode functionalities for #336, includes: Fix the crash when enter the tmux control mode, Fix press 'q' cannot quit the tmux control mode instantly, Sync the tabs(tmux call it window), panels, split panels, Sync the context, include maximum 2000 lines history, cursor, Sync the window name, Sync the tab/panel focus to back end, Sync the window/panel size change to back end, Focus on the window/panel when last time detach, Prune the panels/windows when the back end quit them, Spawn tab, Split panel, Tmux backwards compatibility. All the functionalities I planned are done, now I can use wezterm to replace iTerm2 completely.

### @jayPare
> Didn't looked at the code since I'm not very familiar with Wezterm code base, but I might take a quick look. However, I built from source on Windows and tested connecting to tmux 3.4 on a Linux machine. Everything seems to work properly. Thank you for that!

### @felixding
> Thank you for your work. AFAIK, this is the first full implementation of tmux control mode besides iTerm2. Really looking forward to it.

### @pescobar
> I have tested it on linux and control mode is working fine in the light test I did but I noticed that if I launch `tmux` inside wezterm (no control mode) and use right click with mouse I get the tmux menu as in the screenshot below but I start tmux in control mode with `tmux -CC` I don't get the same menu when using right click

### @LeszekSwirski
> Home/End keys not working under Linux, suggesting incomplete keyboard mapping in control mode implementation.

### @joexue
> it is windows ConPTY issue, not related to this commit

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
