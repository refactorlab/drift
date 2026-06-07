# mozilla/pdf.js #18900 — Annotation deletion popup (bug 1899731)

**[View PR on GitHub](https://github.com/mozilla/pdf.js/pull/18900)**

| | |
|---|---|
| **Author** | @ryzokuken |
| **Status** | ✅ merged |
| **Opened** | 2024-10-14 |
| **Repo importance** | ★53,401 · 10,625 forks · score 100,897 |
| **Diff** | +1249 / −92 across 18 files |
| **Engagement** | 65 conversation · 162 inline review comments |

## Top review comments (ranked by reactions)

### @marco-c — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/mozilla/pdf.js/pull/18900#issuecomment-2411728079)

> > Is this perhaps related to https://bugzilla.mozilla.org/show_bug.cgi?id=1899731, since there seems to be no mention of that bug here?
> > 
> > Please note that we'll need a "full" design specification _before_ implementing this, and given its current state the code will also require a fair amount of work here (as far as I can tell).
> 
> I added a link to the Figma specs in the bug. It should be accessible to all of you (let me know if you don't have access, and I'll get you added).

### @Snuffleupagus — 1 reactions  
`👍 1`  ·  [link](https://github.com/mozilla/pdf.js/pull/18900#issuecomment-2428745371)

> https://github.com/mozilla/pdf.js/pull/18900#pullrequestreview-2368482095 mentioned undoing via the keyboard, in which case I believe that we also should hide the undo-bar, however looking at the code that may not have been implemented yet (but please note that I've not actually tested the patch).
> 
> Would it work if we always invoke `this._editorUndoBar?.hide();` in the following method?
> https://github.com/mozilla/pdf.js/blob/d37e4b08e4006b382b14b1596c5f70df7e93fbd9/src/display/editor/tools.js#L2010-L2020

### @calixteman — 1 reactions  
`👍 1`  ·  [link](https://github.com/mozilla/pdf.js/pull/18900#issuecomment-2485106505)

> On Windows, when the toast appears, NVDA is reading "Toolbar  Undo button" which means that the description and the close button are missed: they probably needs to have some aria attributes.
> I didn't check on mac with VoiceOver but you should give it a try to make sure that everything is correctly read.

### @calixteman — 1 reactions  
`👍 1`  ·  [link](https://github.com/mozilla/pdf.js/pull/18900#issuecomment-2506443250)

> @ryzokuken could you fix the bug mentioned in https://github.com/mozilla/pdf.js/pull/18900#issuecomment-2504592921 ? and add a test (just for one kind of editor) to check that "clicking" on undo with the keyboard is working as expected. Thank you.

### @nicolo-ribaudo — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/18900#issuecomment-2411774566)

> @calixteman @Snuffleupagus Please wait to review until when this PR is marked as ready -- I am giving some feedback to @ryzokuken to make sure that it matches correctly what is defined in the figma doc :)

### @ryzokuken — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/18900#issuecomment-2412491232)

> First off, thanks everyone for all the comments it's nice to have a stronger sense of direction as to where I need to take this patch. I addressed some of the comments y'all made and marked the appropriate suggestions as "resolved" although please feel free to re-raise anything.
> 
> To respond to the questions:
> 
> > Is this perhaps related to [bugzilla.mozilla.org/show_bug.cgi?id=1899731](https://bugzilla.mozilla.org/show_bug.cgi?id=1899731), since there seems to be no mention of that bug here?
> 
> > Please note that we'll need a "full" design specification before implementing this, and given its current state the code will also require a fair amount of work here (as far as I can tell).
> 
> Yes it is! Thanks @marco-c for the clarification and sharing the spec. Regarding the code, I hope the bigger pain points have either already been addressed or I'd be hacking on them shortly.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
