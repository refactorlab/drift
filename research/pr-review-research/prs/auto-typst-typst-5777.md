# typst/typst #5777 — Use "subs" and "sups" font features for typographic scripts

**[View PR on GitHub](https://github.com/typst/typst/pull/5777)**

| | |
|---|---|
| **Author** | @MDLC01 |
| **Status** | ✅ merged |
| **Opened** | 2025-01-29 |
| **Repo importance** | ★54,010 · 1,592 forks · score 65,373 |
| **Diff** | +450 / −197 across 21 files |
| **Engagement** | 17 conversation · 101 inline review comments |

## Top review comments (ranked by reactions)

### @laurmaedje — 3 reactions  
`🎉 1 · 🚀 2`  ·  [link](https://github.com/typst/typst/pull/5777#issuecomment-3026861647)

> Thanks a lot for your work and patience with this!

### @laurmaedje — 1 reactions  
`👍 1`  ·  [link](https://github.com/typst/typst/pull/5777#issuecomment-2999473024)

> I responded to or marked the comments as resolved. Probably you have already seen, but if not, note that there are also still conflicts on the PR.

### @MDLC01 — 0 reactions  
`—`  ·  [link](https://github.com/typst/typst/pull/5777#issuecomment-2621919877)

> New Computer Modern, Roboto, Liberation, do not support "sups" even for digits. So `show footnote: set super(typographic: true)` is probably a bad idea.

### @T0mstone — 0 reactions  
`—`  ·  [link](https://github.com/typst/typst/pull/5777#issuecomment-2624199599)

> Note that the standard you quoted only applies to superscript *letters*, not numbers like ¹.
> It might actually be good to keep using the superscript characters for numbers, they tend to look better IMO.
> 
> Edit: The relevant section for the superscript digits is https://www.unicode.org/versions/Unicode16.0.0/core-spec/chapter-22/#G42931
> 
> It also seems to agree with you here tho:
> > In general, the Unicode Standard does not attempt to describe the positioning of a character above or below the baseline in typographical layout. Therefore, the preferred means to encode superscripted letters or digits, such as “1<sup>st</sup>” or “DC00<sub>16</sub>”, is by style or markup in rich text.
> 
> The question being whether typst's output counts as "rich text", similar to the discussion about #5734 (The thread there doesn't have any, so it might have been on Discord).

### @MDLC01 — 0 reactions  
`—`  ·  [link](https://github.com/typst/typst/pull/5777#issuecomment-2624453440)

> > It might actually be good to keep using the superscript characters for numbers, they tend to look better IMO.
> 
> But as you noted later, they shouldn't really be used that way. The real solution is to use the font features (at least for footnotes, it should be the default imo), which does indeed look betters with fonts that support it (e.g., Libertinus Serif uses the same glyph for "²" and `sups` "2" I believe)
> 
> > The question being whether typst's output counts as "rich text"
> 
> I don't see any reason why it wouldn't. Quoting [Wikipedia](https://en.wikipedia.org/wiki/Formatted_text):
> 
> > In [computing](https://en.wikipedia.org/wiki/Computing), **formatted text**, **styled text**, or **rich text**, as opposed to [plain text](https://en.wikipedia.org/wiki/Plain_text), is [digital text](https://en.wikipedia.org/wiki/E-text) which has styling information beyond the minimum of semantic elements: colours, styles ([boldface](https://en.wikipedia.org/wiki/Boldface), [italic](https://en.wikipedia.org/wiki/Italic_type)), [sizes](https://en.wikipedia.org/wiki/Point_(typography)), and special features in [HTML](https://en.wikipedia.org/wiki/HTML) (such as [hyperlinks](https://en.wikipedia.org/wiki/Hyperlink)).

### @MDLC01 — 0 reactions  
`—`  ·  [link](https://github.com/typst/typst/pull/5777#issuecomment-2628929799)

> I converted the PR to a draft as it seems there are still some possible improvements.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
