# go-gitea/gitea #36764 — Replace Monaco with CodeMirror

**[View PR on GitHub](https://github.com/go-gitea/gitea/pull/36764)**

| | |
|---|---|
| **Author** | @silverwind |
| **Status** | ✅ merged |
| **Opened** | 2026-02-26 |
| **Repo importance** | ★56,132 · 6,774 forks · score 88,227 |
| **Diff** | +2590 / −766 across 48 files |
| **Engagement** | 91 conversation · 144 inline review comments |

## Top review comments (ranked by reactions)

### @silverwind — 1 reactions  
`🎉 1`  ·  [link](https://github.com/go-gitea/gitea/pull/36764#issuecomment-3968114033)

> many styling fixes done, here is the search panel now:
> 
> <img width="741" height="351" alt="image" src="https://github.com/user-attachments/assets/00e9b891-f624-4f9c-a6d6-7e53c2878ea7" />

### @silverwind — 1 reactions  
`👍 1`  ·  [link](https://github.com/go-gitea/gitea/pull/36764#issuecomment-3968255878)

> > trim_trailing_whitespace is now only done in backend - previously I think it was also done in frontend?
> 
> CodeMirror does not have such a feature currently, but maybe it can be re-implemented.

### @bircni — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/go-gitea/gitea/pull/36764#issuecomment-3968385075)

> I also have no complaints @silverwind 😉

### @silverwind — 1 reactions  
`👍 1`  ·  [link](https://github.com/go-gitea/gitea/pull/36764#issuecomment-3986701102)

> The only feature that could be considered missing is tooltips and go-to-definition that Monaco had, but these feature were half-baked in Monaco and only worked in the current file. Normally in VSCode, Monaco is backed by an LSP (tsserver or gopls for example) which makes these feature work cross-file.
> 
> Other than that, everything including VSCode shortcuts and command palette is there.
> 
> Tooltips and go-to-definition can be added later but it will likely require building LSP servers as WASM modules. The client side LSP [already exists](https://github.com/codemirror/lsp-client).

### @silverwind — 1 reactions  
`👍 1`  ·  [link](https://github.com/go-gitea/gitea/pull/36764#issuecomment-4020184587)

> Syntax higlighting colors are now much closer to Chroma color. I had to add a few language-specific overrides for JSON, YAML etc because these parsers identify tokens differently. I reviewed the top 30 languaguages for maximum compatibility.
> 
> Higlight in markdown fences also works now:
> 
> <img width="398" height="554" alt="image" src="https://github.com/user-attachments/assets/35651bf3-fc14-491b-aebc-2e1a064beb8d" />

### @silverwind — 1 reactions  
`👍 1`  ·  [link](https://github.com/go-gitea/gitea/pull/36764#issuecomment-4055365342)

> One thing I do know is that light and dark theme don't have the same token-to-color mapping, e.g. something red on dark could be blue on light.
> 
> Maybe it's time to design a single syntax theme that usethe same color hues just with different lightness on light and dark. There's certainly a few things I would want to change, like giving comments more contrast in diffs.
> 
> I guess I would model the new "unified" theme based on the current dark theme, with a few tweaks. Maybe take a bit of influence from GitHub's theme, but don't copy it exactly.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
