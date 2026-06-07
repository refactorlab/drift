# ryanoasis/nerd-fonts #1980 — Add Braille support (with generator)

**[View PR on GitHub](https://github.com/ryanoasis/nerd-fonts/pull/1980)**

| | |
|---|---|
| **Author** | @Finii |
| **Status** | ✅ merged |
| **Opened** | 2026-01-22 |
| **Repo importance** | ★63,239 · 3,900 forks · score 82,744 |
| **Diff** | +212 / −18 across 7 files |
| **Engagement** | 25 conversation · 15 inline review comments |

## Top review comments (ranked by reactions)

### @GoldPigg — 2 reactions  
`👍 1 · 🎉 1`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1980#issuecomment-3790840104)

> > I'm not sure I understand this
> 
> I'm sorry for my confusing expression.
> 
> I've now re-evaluated the two options. Although I've generated rectangles as squares, it doesn't significantly impact the outcome. We can make a simple adjustment later.
> 
> **circular**:
> ![circular](https://github.com/user-attachments/assets/e3781a3f-ae3f-4a78-b148-a58877f47cc9)
> 
> **rectangles**:
> ![rectangles](https://github.com/user-attachments/assets/734b9cb5-862a-4897-b020-7b4d26f8a5da)
> 
> Now my opinion seems to have changed—rectangles do appear to work better (may more rich and full).

### @Finii — 1 reactions  
`👍 1`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1980#issuecomment-3834104966)

> Ah, thank you!
> 
> > Braille suffix. It seems to have been accidentally deleted
> 
> In fact I dropped it willingly, as I doubt the usefullness of the suffix. Further up the commnet says:
> 
> ```python
>         if not self.args.complete:
>             # NOTE not all symbol fonts have appended their suffix here
>             if self.args.fontawesome:
>                 additionalFontNameSuffix += " A"
>                 verboseAdditionalFontNameSuffix += " Plus Font Awesome"
> ```
> 
> Lets see if the comment is correct
> 
> ```
>     sym_font_group.add_argument('--braille',
>     sym_font_group.add_argument('--complete',
>     sym_font_group.add_argument('--codicons',
>     sym_font_group.add_argument('--fontawesome',
>     sym_font_group.add_argument('--fontawesomeext',
>     sym_font_group.add_argument('--fontlogos',
>     sym_font_group.add_argument('--material',
>     sym_font_group.add_argument('--octicons',
>     sym_font_group.add_argument('--pomicons',
>     sym_font_group.add_argument('--powerline',
>     sym_font_group.add_argument('--powerlineextra',
>     sym_font_group.add_argument('--powersymbols',  
>     sym_font_group.add_argument('--weather',
> ```
> ```
>         if not self.args.complete:
>             # NOTE not all symbol fonts have appended their suffix here
>             if self.args.braille:    
>             if self.args.codicons:
>             if self.args.fontawesome:
>             if self.args.fontawesomeextension:
>             if self.args.fontlogos:
>             if self.args.material:
>             if self.args.octicons: 
>             if self.args.pomicons:
>             if self.args.powersymbols:
>             if self.args … *[truncated]*

### @GoldPigg — 0 reactions  
`—`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1980#issuecomment-3785016600)

> I'm glad I could help you.
> 
> ### [NOTE]
> **I seem to have forgotten to update the version of `font-patcher`. You might need to update it.**

### @GoldPigg — 0 reactions  
`—`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1980#issuecomment-3785020476)

> > You create the classic round 'dots', what do you think about the octants style proposed above?
> 
> I'm not entirely sure about this, because the reason I'm doing this work is that I myself am a **victim of non-equidistant Braille fonts**. Therefore, classic round ‘dots’ represent my **original requirement**.
> 
> And I suspect most users feel the same way. Perhaps we could introduce **command-line arguments** for customization, or allow both styles to **coexist**.
> 
> However, if adding octants style is desired, I don't think it would be difficult. Based on the existing code, we could reuse most of it—basically just adjust the `draw` function.
> 
> If you feel it's truly necessary, I could give it a try. But I might not have much free time recently, so it might not get done quickly.
> 
> What do you think?🤔

### @Finii — 0 reactions  
`—`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1980#issuecomment-3786048927)

> * https://github.com/ryanoasis/nerd-fonts/discussions/1931

### @Finii — 0 reactions  
`—`  ·  [link](https://github.com/ryanoasis/nerd-fonts/pull/1980#issuecomment-3786099657)

> > > what do you think about
> 
> > What do you think?🤔
> 
> :-D
> 
> I'm not sure I understand this:
> 
> > the reason I'm doing this work is that I myself am a victim of non-equidistant Braille fonts. Therefore, classic round ‘dots’ represent my original requirement.
> 
> If the 'dots' are circular or rectangles does not change the equidistance? Of course they can not / should not be square.
> 
> And yes, your code design is nice where the circles can easily be exchanged for rectangles.
> 
> In the other thread "the people" seemed to like octants more, so I wanted to know your preference / reasoning.
> Maybe you want to try rectangular dots with your "image"?
> 
> > And I suspect most users feel the same way.
> 
> I had the impression most would prefer rectangular 'dots'. Equidistant of course. Or even gapless (but I know from experience that gapless is always hard to achieve over different clients that render the glyphs differently).
> 
> > command-line arguments for customization
> 
> The problem is that only ONE style could be the default; and most of the time people use the prepatched fonts (which use the defaults of course).
> 
> _Edit: Add last parenthesised sentence to better explain what I mean_


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
