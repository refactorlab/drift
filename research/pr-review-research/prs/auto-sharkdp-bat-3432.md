# sharkdp/bat #3432 — make --help and -h use pager

**[View PR on GitHub](https://github.com/sharkdp/bat/pull/3432)**

| | |
|---|---|
| **Author** | @MuntasirSZN |
| **Status** | ✅ merged |
| **Opened** | 2025-10-11 |
| **Repo importance** | ★59,273 · 1,572 forks · score 70,499 |
| **Diff** | +0 / −0 across 0 files |
| **Engagement** | 20 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @keith-hall — 1 reactions  
`👍 1`  ·  [link](https://github.com/sharkdp/bat/pull/3432#issuecomment-3419590943)

> In my testing, it seems to ignore the `--theme` option, and always uses the default theme. i.e. `bat --theme=TwoDark --help` gives the same output as `bat --theme=ansi --help`, which is unexpected

### @keith-hall — 1 reactions  
`👍 1`  ·  [link](https://github.com/sharkdp/bat/pull/3432#issuecomment-3419837097)

> I realize it must be annoying to have reviews come in piecemeal, but sometimes its hard to do a complete review in one pass, especially when things need tweaking. I do appreciate your diligence in this one, however :+1: 
> I think it is nearly ready. I notice it currently doesn't respect the theme from the config file or `BAT_THEME` env var, which would be nice to have working... This is kind of what I meant, that it would be easier to maintain if we didn't have to special-case everything for help, just have it working through the same code-path like for other inputs...

### @Enselic — 1 reactions  
`👍 1`  ·  [link](https://github.com/sharkdp/bat/pull/3432#issuecomment-3478740295)

> It wasn't merged. The pull[bot] force-pushed away the commit. My suggestion is to stop using pull[bot]. I hope you get better.

### @MuntasirSZN — 0 reactions  
`—`  ·  [link](https://github.com/sharkdp/bat/pull/3432#issuecomment-3395207394)

> > A couple of questions - does it honor `--paging=never` on the command line and in the config file(s)? And does/can the help display keep the original colors from clap, or should it apply our help syntax highlighting?
> 
> No, it doesn't honor. Its the same behavior as list-themes and list-languages. Colors cannot be shown, as its converted to string. Yes, our help highlighting can be used. Lemme do it asap.

### @MuntasirSZN — 0 reactions  
`—`  ·  [link](https://github.com/sharkdp/bat/pull/3432#issuecomment-3395221958)

> @keith-hall i think just setting `language: Some("help")` will do, right?

### @keith-hall — 0 reactions  
`—`  ·  [link](https://github.com/sharkdp/bat/pull/3432#issuecomment-3395225810)

> Yep, that should do the trick 👍 once done, it will be useful to compare the output highlighted from clap and this one, so please post a before and after screenshot 🙂 
> 
> Also, I think we should support when the user requests to skip the pager (and colors), especially if someone wants to pipe the output to a file or into another program
> 
> Edit: plus, as the pager is configurable, especially now that minus is an option, it would make sense to ensure it uses the configured pager. And let's add an integration test for the help output, to ensure that we catch regressions in the highlighting.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
