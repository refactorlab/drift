# mozilla/pdf.js #19110 — Enable automatic URL linking (bug 1019475)

**[View PR on GitHub](https://github.com/mozilla/pdf.js/pull/19110)**

| | |
|---|---|
| **Author** | @ryzokuken |
| **Status** | ✅ merged |
| **Opened** | 2024-11-26 |
| **Repo importance** | ★53,401 · 10,625 forks · score 100,897 |
| **Diff** | +656 / −14 across 20 files |
| **Engagement** | 35 conversation · 108 inline review comments |

## Top review comments (ranked by reactions)

### @calixteman — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/mozilla/pdf.js/pull/19110#issuecomment-2605022232)

> > How does this perform, especially in documents that contain a lot of text?
> > 
> > Also, we probably want a new option/preference to be able to disable this functionality.
> 
> Yep it's better to have a pref on the firefox side too.
> 
> That said, I rendered the first 403 pages of `pdf.pdf` (in wrapped mode and with a zoom set to 10) and here's a profile:
> https://share.firefox.dev/42mf3uA
> 
> and the overall time spent in `processLinks` is ~131ms !! so it shouldn't be a problem.

### @Snuffleupagus — 1 reactions  
`👍 1`  ·  [link](https://github.com/mozilla/pdf.js/pull/19110#issuecomment-2606564566)

> > addressed your suggestions. Thanks for the reviews!
> 
> Please make sure that you go through and address *all* outstanding (older) review comments.
> 
> > The failure at the moment comes from additional objects being exposed from `pdfjs-lib` (I hope that's okay).
> 
> As should *hopefully* be obvious, you need to fix the failing tests by updating the expected values (since no patch will be allowed to land if it breaks e.g. unit-tests).
> 
> > Also I updated the tests but for some reason couldn't ensure that the `enableAutoLinking` app option was set properly so let me know if I'm invoking that incorrectly somehow.
> 
> I'm guessing that you're referring to the integration-tests, so perhaps this is relevant?
> https://github.com/mozilla/pdf.js/blob/877f69886c3e000fb7be2d82d536476032f2b8e4/web/app.js#L352-L364

### @ryzokuken — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/19110#issuecomment-2533200483)

> @Snuffleupagus
> 
> >  Besides, it isn't necessary since the textContent is already available once the textLayer has rendered; see
> 
> I was a bit unsure if I understood exactly what you were suggesting but how does this commit look? It "fetches" the textContents from the previous render of the textLayer and makes the processing step sync.
> 
> https://github.com/mozilla/pdf.js/pull/19110/commits/93e5417a4e1dfcdbe7a2a9adab9ae7d917445681

### @ryzokuken — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/19110#issuecomment-2536267499)

> @Snuffleupagus nvm my last comment, I figured it out after looking at `pdfPageView._textHighlighter.textDivs` a couple of times it occurred to me what you were talking about.
> 
> https://github.com/mozilla/pdf.js/pull/19110/files#diff-71772f56be799df522c2076ab5fa476253ef15c607af5812536c41696d97cd59R73

### @ryzokuken — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/19110#issuecomment-2606010844)

> @calixteman @Snuffleupagus addressed your suggestions. Thanks for the reviews! The failure at the moment comes from additional objects being exposed from `pdfjs-lib` (I hope that's okay).
> 
> Also I updated the tests but for some reason couldn't ensure that the `enableAutoLinking` app option was set properly so let me know if I'm invoking that incorrectly somehow.

### @ryzokuken — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/19110#issuecomment-2609993224)

> I believe I have addressed every single comment that was still unresolved and have proceeded to mark them as resolved. Please check out the PR now and let me know what you think or if there's something that's still off by any chance.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
