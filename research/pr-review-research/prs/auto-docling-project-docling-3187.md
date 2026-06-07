# docling-project/docling #3187 — feat: explicit TikZ environment handling in LaTeX backend

**[View PR on GitHub](https://github.com/docling-project/docling/pull/3187)**

| | |
|---|---|
| **Author** | @StealthTensor |
| **Status** | ✅ merged |
| **Opened** | 2026-03-25 |
| **Repo importance** | ★61,011 · 4,260 forks · score 83,049 |
| **Diff** | +317 / −5 across 4 files |
| **Engagement** | 24 conversation · 13 inline review comments |

## Top review comments (ranked by reactions)

### @PeterStaar-IBM — 1 reactions  
`👀 1`  ·  [link](https://github.com/docling-project/docling/pull/3187#issuecomment-4168519702)

> @StealthTensor Let me know when the update is ready, happy to get it merged in soon!
> 
> @adityasasidhar Might be interesting for your latex parser!

### @StealthTensor — 1 reactions  
`🚀 1`  ·  [link](https://github.com/docling-project/docling/pull/3187#issuecomment-4168770881)

> > @StealthTensor Let me know when the update is ready, happy to get it merged in soon!
> > 
> > @adityasasidhar Might be interesting for your latex parser!
> 
> Awesome, I have the update ready, will push the commits as soon as I'm back at my laptop. Cheers!

### @StealthTensor — 1 reactions  
`👍 1`  ·  [link](https://github.com/docling-project/docling/pull/3187#issuecomment-4184490135)

> > @StealthTensor
> > 
> > Hey please do look at:
> > 
> > line 187 to 190
> > 
> > ```
> >         if getattr(parent, "name", None) == "figure":
> >             picture_parent = parent
> >         else:
> >             picture_parent = parent
> > ```
> 
> good catch 😅 @adityasasidhar  just removed that redundant block. thanks for reviewing.

### @PeterStaar-IBM — 1 reactions  
`😄 1`  ·  [link](https://github.com/docling-project/docling/pull/3187#issuecomment-4223585685)

> > @PeterStaar-IBM all requested changes have been pushed. let me know if you need anything else, otherwise this should be ready for ci approval and merge
> 
> nice, let's let the CI do its job

### @PeterStaar-IBM — 1 reactions  
`👍 1`  ·  [link](https://github.com/docling-project/docling/pull/3187#issuecomment-4228148444)

> > @PeterStaar-IBM hey , i updated code to strictly use CodeMetaField and CodeLanguageLabel.TIKZ as requested
> > 
> > but, it looks like the CI is failing because the runner is pulling an older version of docling-core from PyPI that doesnt have the new TIKZ label yet
> > 
> > how would you like to handle this?
> 
> easy: you need to update the the version of `docling-core` in the `pyproject.toml`  and then run `uv lock`.

### @StealthTensor — 0 reactions  
`—`  ·  [link](https://github.com/docling-project/docling/pull/3187#issuecomment-4134277339)

> Friendly ping — CI is green and this is ready for review. Happy to address any feedback. Thanks!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
