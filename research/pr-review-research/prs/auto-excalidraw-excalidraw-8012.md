# excalidraw/excalidraw #8012 — feat: introduce font picker

**[View PR on GitHub](https://github.com/excalidraw/excalidraw/pull/8012)**

| | |
|---|---|
| **Author** | @Mrazator |
| **Status** | ✅ merged |
| **Opened** | 2024-05-12 |
| **Repo importance** | ★124,659 · 13,923 forks · score 185,342 |
| **Diff** | +3390 / −1106 across 120 files |
| **Engagement** | 28 conversation · 3 inline review comments |

## Top review comments (ranked by reactions)

### @Mrazator — 2 reactions  
`❤️ 1 · 👀 1`  ·  [link](https://github.com/excalidraw/excalidraw/pull/8012#issuecomment-2234266075)

> @karlhorky:
> 
> > @Mrazator would you also consider adding 3 system fonts stacks?
> > 
> > Benefits:
> > 
> > * no heavy embed necessary (keep exported SVGs small)
> > * can be used in environments such as GitHub readmes / Markdown, which have Content Security Policy rules [fix: add fallbacks for all fonts #6550](https://github.com/excalidraw/excalidraw/pull/6550)
> 
> With this PR we've tackled the second point, but it's true inlining the whole font isn't ideal. Hence, as the next step, we shall be inlining only the necessary glyphs inside the to-be exported SVG.
> 
> > Caveats:
> > 
> > * they appear different on different OSes (could be communicated to the user)
> >
> 
> That's the first problem, but that raises much more issues under the hood:
> - rendering inconsistencies between the OSes (that's the one you pointed out)
> - layout shift between canvas (`fillText`) and wysiwyg (`textarea`) - that's a big one we've been fighting recently (https://github.com/excalidraw/excalidraw/pull/7693), and the best solution so far was storing font metrics per font; which isn't possible with local fonts, as we don't know the one that will be used as fallback and we couldn't read the font files to get the metrics due to browser restrictions
> - text wrapping inconsistencies between the OSes, as each glyph has slightly different width metrics, which browser is aware of when it renders inside wysiwyg (textarea), but we are not when we wrap the text (due to the unknown fonts as described above)
> - server-side SVG / PNG / PDF export (E+) would be rendered with a different font, with different metrics, so all issues above wou … *[truncated]*

### @zsviczian — 1 reactions  
`👍 1`  ·  [link](https://github.com/excalidraw/excalidraw/pull/8012#issuecomment-2243611793)

> This looks super exciting. The user community is going to sing and dance!
> 
> I haven't looked at the code in detail yet, so sorry for the RTFM comments and questions...  I will look at the code this week to see the impact on the Obsidian plugin.
> 
> This will require a more in-depth look at the Obsidian fork since I've been using fontfamily 4 for the local (fourth) font. For this reason, I have also messed with Assistant when it was introduced. Nothing, that can't be changed, but I will need to look at the restore function to clean up the legacy font family reference.
> I hope the change supports other font types such as TTF and OTF, not just WOFF.
> Inline fonts in SVGs is also a great addition, this is something I will need to remove from the plugin. Great to have it in the core package.
> 
> Because I am sure there will be immediate pressure from the Obsidian users for this, I will try to merge this PR into a test fork for Obsidian in the next 2-3 days and let you know if I hit any issues.

### @Mrazator — 1 reactions  
`👍 1`  ·  [link](https://github.com/excalidraw/excalidraw/pull/8012#issuecomment-2249813942)

> > Does assistant remain as a UI-only font?
> 
> Yes, it remains as the UI font. Previously, it was also used during export to render frame labels, hence the need for the `FONT_FAMILY` and related metrics (hacky). Now, this only occurrence was [replaced](https://github.com/excalidraw/excalidraw/pull/8012/files#diff-3b7f8941547eddf8d5f5f2ff01c91cbe3e200b9344c64e8c8f64b829944e89ddR104) with Helvetica (system font), therefore it's possible to deprecate it's `FONT_FAMILY` value. 
> 
> > when skipInliningFonts: true why are we not embedding the old defs with links to the font on excalidraw.com?
> 
> This flag is used when generating PDF / PNG / PPTX server-side out of SVG (E+) to keep their sizes small, as the PDF / PNG / PTX renderers do not use the font-faces defined in the SVG <style> element. We could perhaps keep the "old defs", but we don't want to add new ones, as each new font we have to be available forever on the `excalidraw.com` domain (due to backwards compatibility). In the future, we will be doing glyph subsetting in SVGSs, to keep their sizes small (with the inlined fonts) as well.

### @zsviczian — 1 reactions  
`👍 1`  ·  [link](https://github.com/excalidraw/excalidraw/pull/8012#issuecomment-2251008284)

> I've already built the necessary APIs for Obsidian :)

### @DanielJGeiger — 1 reactions  
`👍 1`  ·  [link](https://github.com/excalidraw/excalidraw/pull/8012#issuecomment-2253694071)

> I merged this PR from the `release` branch into MathJax support (#6037) with only minimal merge conflicts.

### @ad1992 — 0 reactions  
`—`  ·  [link](https://github.com/excalidraw/excalidraw/pull/8012#issuecomment-2106904016)

> Hi @Mrazator 👋🏻
> Excited about this one!
> I have some queries, could you please elaborate on the 👇🏻 
> Which fonts are we adding to the font picker? 
> This probably will affect the NPM package as well ?
> Will the users be also able to add their own fonts or is it limited to Excalidraw fonts?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
