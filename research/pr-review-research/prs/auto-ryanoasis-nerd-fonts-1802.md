# ryanoasis/nerd-fonts #1802 — Atkinson hyperlegible mono

**[View PR on GitHub](https://github.com/ryanoasis/nerd-fonts/pull/1802)**

| | |
|---|---|
| **Author** | @joshestein |
| **Status** | ✅ merged |
| **Opened** | 2025-02-20 |
| **Repo importance** | ★63,239 · 3,900 forks · score 82,744 |
| **Diff** | +134 / −8 across 16 files |
| **Engagement** | 15 conversation · 11 inline review comments |

## Top review comments (ranked by reactions)

### @Finii — 1 reactions  
`👍 1`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1802#issuecomment-2673525557)

> > I'm not sure if this is something to worry about?
> 
> No that is a fontforge message we can not suppress.

### @joshestein — 1 reactions  
`👍 1`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1802#issuecomment-2673913206)

> No, it was just because they were in the root directory.

### @Finii — 1 reactions  
`🎉 1`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1802#issuecomment-2674127799)

> Will pull shortly before the release, as the website is updated instantly and that would point to a non-existing release file :grimacing: 
> 
> Thanks again

### @Finii — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1802#issuecomment-2674129241)

> @allcontributors please add @joshestein for code

### @zurdala — 1 reactions  
`👍 1`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1802#issuecomment-2778114690)

> Can't wait to have this! Thank you, guys, for putting the time. I love this font

### @Finii — 0 reactions  
`—`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1802#issuecomment-2673815828)

> Checking...
> 
> ```console
> $ fontforge font-patcher --debug 2 --dry ~/Downloads/AtkinsonHyperlegibleMono-ExtraLightItalic.otf 2>/dev/null
> Nerd Fonts Patcher v3.3.0-75 (4.18.1) (ff 20230101)
> DEBUG: Naming mode 1
> DEBUG: Monospace check: Panose is invalid ([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); glyph-width-mono True
> INFO: Setting Panose 'Family Kind' to 'Latin Text and Display' (was 'Any')
> INFO: Setting Panose 'Proportion' to 'Monospaced' (was 'Any')
> WARNING: Font vertical metrics inconsistent (HHEA 1157 / TYPO 1197 / WIN 1407), using WIN
> DEBUG: Font has negative right side bearing in extended glyphs
> DEBUG: Final font cell dimensions 632 w x 1407 h
> Done with Patch Sets, generating font...
> DEBUG: Weight approximations: OS2/PS/Name: 200/200/200 (from 200/'ExtraLight'/'ExtraLight')
> ERROR: ====-< Family (ID 1)      too long (33 > 31): AtkynsonMono Nerd Font ExtraLight
> DEBUG: =====> SubFamily (ID 2)   ok       ( 6 <=31): Italic
> DEBUG: =====> Fullname (ID 4)    ok       (40 <=63): AtkynsonMono Nerd Font ExtraLight Italic
> DEBUG: =====> PSN (ID 6)         ok       (31 <=63): AtkynsonMonoNF-ExtraLightItalic
> DEBUG: =====> PrefFamily (ID 16) ok       (22 <=31): AtkynsonMono Nerd Font
> DEBUG: =====> PrefStyles (ID 17) ok       (17 <=31): ExtraLight Italic
> DEBUG: =====> Filename 'AtkynsonMonoNerdFont-ExtraLightItalic.otf'
> ```
> 
> Ok, `--makegroups 4` is probably right, it would not be needed anymore, but keeping it for futureproof name handling.
> 
> Metrics needs investigation. Why is it using WIN, I have forgotten everything, but this feels wrong. Results in next comment.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
