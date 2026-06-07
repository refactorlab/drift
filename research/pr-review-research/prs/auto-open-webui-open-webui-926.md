# open-webui/open-webui #926 — Add i18n

**[View PR on GitHub](https://github.com/open-webui/open-webui/pull/926)**

| | |
|---|---|
| **Author** | @asedmammad |
| **Status** | ✅ merged |
| **Opened** | 2024-02-26 |
| **Repo importance** | ★140,116 · 20,118 forks · score 225,578 |
| **Diff** | +6909 / −808 across 68 files |
| **Engagement** | 73 conversation · 11 inline review comments |

## Top review comments (ranked by reactions)

### @tjbck — 5 reactions  
`🎉 5`  ·  [link](https://github.com/open-webui/open-webui/pull/926#issuecomment-2001926751)

> Just tried it out, and this is beyond amazing! Thanks for all the effort and being a part of this journey guys! We're one step closer to truly democratising access to AI for all! I'll merge this to dev branch right now and feel free to make additional PRs in case anything needs to be fixed!

### @BYTOOX — 4 reactions  
`👍 3 · ❤️ 1`  ·  [link](https://github.com/open-webui/open-webui/pull/926#issuecomment-1971051150)

> Hey, this project is really interesting. If you need some french translator, i'm up to the task.

### @jannikstdl — 4 reactions  
`🎉 4`  ·  [link](https://github.com/open-webui/open-webui/pull/926#issuecomment-1997600897)

> It's ready to be tested, thanks for the work everyone!!
> > ```
> > docker pull ghcr.io/justinh-rahb/open-webui:dev
> > ```
>  After some user testing this should be ready to merge @tjbck 
> @asedmammad also marked it as ready for review.
> 
> **Future open points i noticed**
> Would be nice to change the RAG template / Title generation template dynamically too since this works better for the LLMs

### @jannikstdl — 3 reactions  
`👍 3`  ·  [link](https://github.com/open-webui/open-webui/pull/926#issuecomment-1979126893)

> @justinh-rahb yes that's normal because we don't have a French translated file yet. 
> 
> Something I noticed:
> - If you change the language the title generation prompt only changes if you go to the settings under "interface" and delete the content - hit save and then go back to the interface tab. 
> Only then it gets changed to the selected language.  
> 
> - For future translators because of updates it gets hard to keep track of which textelements can be translated. Maybe we can automate that whenever we add a i18n variable in the code it automatically gets added to the common.json files.  I think the plugin "i18n parser" for i18next does that.

### @BYTOOX — 3 reactions  
`🚀 3`  ·  [link](https://github.com/open-webui/open-webui/pull/926#issuecomment-1981047037)

> Here is the french translation file. https://www.swisstransfer.com/d/8129ba9d-66d3-494a-8d33-bb7ee6f423fe

### @asedmammad — 3 reactions  
`👍 3`  ·  [link](https://github.com/open-webui/open-webui/pull/926#issuecomment-1984327588)

> > > Had this on my local branch but now its gone. I will fix this.
> > 
> > Okay now i know why its gone. We pushed almost at the same time and it was already in the PR with [12c74b2](https://github.com/open-webui/open-webui/pull/926/commits/12c74b2cd1d9e28f76e676779e84e33ac755cc46)
> > 
> > Lost my mind for 10min, but we should be fine now :D We could add a CHANGELOG.md entry, but maybe this is for tim when he adds this PR.
> 
> Oops! :D
> Changed `i18next-parser` configuration, we should be okay, translation keys will be added as default value. I will test this further to make sure I'm not missing anything here.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
