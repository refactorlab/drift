# ryanoasis/nerd-fonts #1508 — Parallel execution fontforge in docker

**[View PR on GitHub](https://github.com/ryanoasis/nerd-fonts/pull/1508)**

| | |
|---|---|
| **Author** | @nobk |
| **Status** | ✅ merged |
| **Opened** | 2024-02-04 |
| **Repo importance** | ★63,239 · 3,900 forks · score 82,744 |
| **Diff** | +22 / −2 across 3 files |
| **Engagement** | 27 conversation · 4 inline review comments |

## Top review comments (ranked by reactions)

### @Finii — 0 reactions  
`—`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1508#issuecomment-1925855284)

> @allcontributors please add @nobk for code

### @Finii — 0 reactions  
`—`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1508#issuecomment-1925860871)

> As a side note, I did never check if the debug log will be even avaiable when docker is used.
> Note to self: Check that and maybe add moving the logfile to `/out`.

### @nobk — 0 reactions  
`—`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1508#issuecomment-1925896537)

> > I would allow people to specify the `-j` option, as not all want parallel patching. Maybe also helpful would be some output if find turned up with nothing.
> > 
> > Tell me if you want to expand this or if you prefer me merging as-is.
> 
> I will add an option for  `-j PN`, with docker option `-e "PN=1"`, to disable parallel execute.
> ```
> docker run --rm -v /path/to/fonts:/in:Z -v /path/for/output:/out:Z -e "PN=1" nerdfonts/patcher [OPTIONS]
> ```

### @nobk — 0 reactions  
`—`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1508#issuecomment-1925941959)

> I think docker patcher is for users, not for developers, so I am not test logfile output.
> When I set `-e "PN=20"` , all hyper threads of i7-12700K CPU is used, up to 4.9GB RAM used, speed up max.

### @Finii — 0 reactions  
`—`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1508#issuecomment-1927017985)

> Thank you! Appreciate your work :green_heart:

### @Finii — 0 reactions  
`—`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1508#issuecomment-1927051592)

> ![image](https://github.com/ryanoasis/nerd-fonts/assets/16012374/ed8af2b7-aedf-4799-adc8-65cc5bd40565)
> 
> Fixing


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
