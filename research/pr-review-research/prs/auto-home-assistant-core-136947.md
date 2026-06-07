# home-assistant/core #136947 — Add redgtech integration

**[View PR on GitHub](https://github.com/home-assistant/core/pull/136947)**

| | |
|---|---|
| **Author** | @Jonhsady |
| **Status** | ✅ merged |
| **Opened** | 2025-01-30 |
| **Repo importance** | ★87,540 · 37,612 forks · score 242,987 |
| **Diff** | +1041 / −0 across 20 files |
| **Engagement** | 29 conversation · 374 inline review comments |

## Top review comments (ranked by reactions)

### @joostlek — 2 reactions  
`👍 1 · 🚀 1`  ·  [link](https://github.com/home-assistant/core/pull/136947#issuecomment-3117317591)

> Mypy.ini is okay, the other is not for this PR, but I would expect more issues and formatting things to come out of this

### @zweckj — 1 reactions  
`👍 1`  ·  [link](https://github.com/home-assistant/core/pull/136947#issuecomment-2721721567)

> You don't have to keep merging dev into this PR.

### @joostlek — 1 reactions  
`👍 1`  ·  [link](https://github.com/home-assistant/core/pull/136947#issuecomment-3114472161)

> Do you now have a proper development environment? Mind adding one line to a file and then trying to commit it

### @emontnemery — 1 reactions  
`👍 1`  ·  [link](https://github.com/home-assistant/core/pull/136947#issuecomment-3258787307)

> The releases published on PyPi do not match the releases on github.
> Also, the link to the source code on PyPi is wrong, it links to https://github.com/redgtech-automa%C3%A7%C3%A3o/redgtech-api, which is a 404, I guess it should link to https://github.com/redgtech-automacao/redgtech-python-api
> 
> Releases on PyPi:
> <img width="801" height="673" alt="image" src="https://github.com/user-attachments/assets/aa4b3179-43d9-4552-b288-6c15786f8486" />
> 
> There's only a single release on github:
> <img width="924" height="428" alt="image" src="https://github.com/user-attachments/assets/355ba333-b2ad-4a97-8611-6d3585567513" />
> 
> Please make sure your library meets the documented requirements: https://developers.home-assistant.io/docs/api_lib_index?_highlight=libr#basic-library-requirements
> 
> Meeting those requirements are an absolute must, your PR will not be merged otherwise.

### @emontnemery — 1 reactions  
`👍 1`  ·  [link](https://github.com/home-assistant/core/pull/136947#issuecomment-3267608784)

> @Jonhsady the library repo looks a bit better now, but you should remove `build`, `dist` and `redgtech_api` from the repo. They are created by the CI publish job in `.github/workflows/publish.yml`
> 
> Also, I'd suggest to remove the tags + releases 0.1.35, 0.1.36, 0.1.37 from `https://github.com/redgtech-automacao/redgtech-python-api/tags` and `https://github.com/redgtech-automacao/redgtech-python-api/releases` since they are not on PyPi: https://pypi.org/project/redgtech-api/#history

### @emontnemery — 1 reactions  
`👍 1`  ·  [link](https://github.com/home-assistant/core/pull/136947#issuecomment-3437802716)

> The failing tests seem to be mostly located to `strings.json`
> 
> Do you have some local changes which you've forgotten to commit and push?
> Have you run `python3 -m script.translations develop --all` locally?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
