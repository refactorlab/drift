# django/django #19643 — Fixed #36410 -- Added named template partials to DTL

**[View PR on GitHub](https://github.com/django/django/pull/19643)**

| | |
|---|---|
| **Author** | @FarhanAliRaza |
| **Status** | ✅ merged |
| **Opened** | 2025-07-16 |
| **Repo** | curated review-culture seed |
| **Diff** | +1587 / −2 across 16 files |
| **Engagement** | 49 conversation · 133 inline review comments |

## Top review comments (ranked by reactions)

### @nessita — 2 reactions  
`👍 2`  ·  [link](https://github.com/django/django/pull/19643#issuecomment-3138093300)

> > > > I didn't test this branch, ...
> > > 
> > > 
> > > OK, I tested. I can't reproduce this @nessita. With the `"alsonotthere"` version, I get the expected output in the browser.
> > 
> > Thank you! I'll debug more tomorrow, will start from scratch with your project.
> 
> I can confirm this works, as Carlton pointed out. I have just now tested with a bunch of prints removed, I wonder if that was causing the issues I saw before :thinking: 
> 
> As a side note, and not related to this branch nor to the issue above, a print of `exception` as the first statement in `get_exception_info` generates a max recursion error when there is an exception in a template. This is informational since it was very hard to pin point!
> 
> @FarhanAliRaza I guess that one thing that would be useful for me is if you could take a look at the test trying to test more realistically `PartialTemplate.get_exception_info` to, if possible, drop the current mocks.

### @FarhanAliRaza — 2 reactions  
`🎉 1 · 🚀 1`  ·  [link](https://github.com/django/django/pull/19643#issuecomment-3170495353)

> Thank you, @ngnpope and @nessita .   I added the tests you suggested and made other refactors, including changes to test and template names. 
> 
> @carltongibson  I removed that change of instrumented method.

### @FarhanAliRaza — 2 reactions  
`🎉 1 · 🚀 1`  ·  [link](https://github.com/django/django/pull/19643#issuecomment-3179755358)

> Moved `get_template` partial implementation from `DjangoTemplates.get_template` to `Engine.get_template`. Added tests that @nessita  suggested. Thank you, it was a great find. 
> 
> Fixed test mocks for the new implementation.

### @nessita — 2 reactions  
`🚀 2`  ·  [link](https://github.com/django/django/pull/19643#issuecomment-3188320677)

> > I also think your dream should be fulfilled. @nessita 😅 🎉
> 
> Amazing, thank you both. I'll push that change and merge once CI is green. This is very exciting!

### @nessita — 1 reactions  
`👀 1`  ·  [link](https://github.com/django/django/pull/19643#issuecomment-3134593706)

> @ngnpope Hello! Is this PR something you wanted/could take a look? Non worries if not, but let me know when you can.

### @carltongibson — 1 reactions  
`👀 1`  ·  [link](https://github.com/django/django/pull/19643#issuecomment-3137499880)

> @nessita I don't know if this is the issue but, the partial name in the url is `testestest `: 
> 
> `path("partialtestpartial/", TemplateView.as_view(template_name="partialtest.html#testestest"))`
> 
> But the partial in the template is `testtestest`: 
> 
> `{% partialdef testtestest %}`
> 
> There's an extra `t` in the latter one, which would explain the template not found exception.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
