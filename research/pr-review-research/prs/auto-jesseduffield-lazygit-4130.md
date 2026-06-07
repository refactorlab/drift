# jesseduffield/lazygit #4130 — Add ability to configure branch color patterns using regex

**[View PR on GitHub](https://github.com/jesseduffield/lazygit/pull/4130)**

| | |
|---|---|
| **Author** | @mtrajano |
| **Status** | ✅ merged |
| **Opened** | 2024-12-27 |
| **Repo importance** | ★78,963 · 2,860 forks · score 95,391 |
| **Diff** | +58 / −20 across 7 files |
| **Engagement** | 30 conversation · 6 inline review comments |

## Top review comments (ranked by reactions)

### @stefanhaller — 0 reactions  
`—`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4130#issuecomment-2564802470)

> This only seems to support a `*` at the end, and manually matches prefixes before it. If we want to do pattern matching with wildcards in this way, we should use the `Glob` package to support the full globbing syntax.
> 
> However, I'm unsure if globbing is the best solution here. I'd rather thought we'd use regular expressions; they are more powerful and flexible, and we already use them for other things in the user config, e.g. commit prefixes.
> 
> With regular expressions, however, it's a bit harder to maintain backward compatibility transparently. I think for clarity we should add a new config (e.g. `BranchColorPatterns`) and use that instead of the old one as soon as it has at least one entry. Note that Nikita's branch [here](https://github.com/jesseduffield/lazygit/compare/master...castlele:lazygit:branch-colors-with-pattern) doesn't do that quite the way I think it should be: he first checks if there is a match with the new config, and if there isn't, he still falls back to the old config. That's not how I would do it: check the new config (and only the new one) if it has any entries, and only fall back to the old one if it doesn't. This way we can properly deprecate the old one and eventually remove it after some time.

### @castlele — 0 reactions  
`—`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4130#issuecomment-2565290741)

> I'm agree that it would be better to use regular expressions here. On my current place of work we have strict rules about branch naming. So, with power of regular expressions I achieved behavior, when only correctly named branches are highlighted:
> 
> ```yaml
> gui:
>   branchColorPatterns:
>     "IDS+-[0-9]+-[^']+$": '#29d1f7'
> ```

### @mtrajano — 0 reactions  
`—`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4130#issuecomment-2565605842)

> Thank you for the feedback @stefanhaller @castlele I'll adjust the pr accordingly. I agree that using regex will give the user a better ability on how to specify the branch rules.

### @mtrajano — 0 reactions  
`—`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4130#issuecomment-2567219427)

> Had some free time today and updated this pr, let me know if this is closer to what you were imagining @stefanhaller. Given that we have to account for both the new behavior while keeping the old way unchanged it might be a little messy until we deprecate the old behavior. Feel free to suggest any changes, thanks! Here is an image of what it looks like with a sample config:
> <img width="1244" alt="Screenshot 2025-01-01 at 8 46 32 PM" src="https://github.com/user-attachments/assets/cb0c5214-2df8-44ba-bfe3-68c710bf28ed" />

### @jesseduffield — 0 reactions  
`—`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4130#issuecomment-2567267185)

> For what it's worth, that approach looks good to me (code just needs some more documentation, and to be explicit about the old option being deprecated)

### @mtrajano — 0 reactions  
`—`  ·  [link](https://github.com/jesseduffield/lazygit/pull/4130#issuecomment-2568143179)

> @jesseduffield Added some more documentation and deprecation warnings, let me know if you think anything is missing clarity


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
