# facebook/docusaurus #11327 — feat(search): add runtime support for DocSearch v4

**[View PR on GitHub](https://github.com/facebook/docusaurus/pull/11327)**

| | |
|---|---|
| **Author** | @dylantientcheu |
| **Status** | ✅ merged |
| **Opened** | 2025-07-15 |
| **Repo importance** | ★65,128 · 9,918 forks · score 109,787 |
| **Diff** | +2362 / −465 across 58 files |
| **Engagement** | 21 conversation · 57 inline review comments |

## Top review comments (ranked by reactions)

### @NatanTechofNY — 4 reactions  
`👍 1 · ❤️ 1 · 🎉 1 · 🚀 1`  ·  [link](https://github.com/facebook/docusaurus/pull/11327#issuecomment-3292946506)

> @slorber We are live with our stable release 🚀

### @dylantientcheu — 1 reactions  
`🎉 1`  ·  [link](https://github.com/facebook/docusaurus/pull/11327#issuecomment-3133340958)

> Thanks for the detailed feedback 🙏  
> 
> TLDR: this PR no longer forces anyone onto DocSearch v4, keeps the v3 look-and-feel, and gates every v4-only feature behind a version check. Docusaurus v3 users can safely upgrade.
> 
> ### What changed since your review
> 1. **Version range** – `@docsearch/react` is now `"^3.9.0 || ^4.0.0-beta.5 || ^4.0.0"`. Existing sites keep v3 by default; v4 is opt-in.
> 2. **Conditional code paths** – we detect `version.major === 4` once and only wire Ask AI / modal tweaks when that’s true. On v3 everything behaves exactly as before.
> 3. **Search-bar size** – reverted to the v3 dimensions; We are also updating the base package to revert this change.
> 5. **Translations** – new keys are additive; v3 instances ignore them.
> 
> ### On future breaking changes
> I can’t promise we will never tweak the v4 beta–we are still working on some accessibility fixes, but:
> - I can promise that we will NOT change the keyword search (neither the API nor the UX)
> - AskAI will probably morph a bit while we work towards GA.
> - We’ve pinned the exact beta we support (`4.0.0-beta.5`) so downstream installs are stable.
> - If/when DocSearch ships a GA with breaking UI we’ll hold off bumping the range until we’ve tested it against Docusaurus v3 & v4.
> - Worst-case, users stay on the proven v3 line—always within the semver range above–until docusaurus v4 release.
> 
> Happy to tweak anything else you’d like, but I think this addresses the retrofit + UX concerns you raised.

### @slorber — 1 reactions  
`👀 1`  ·  [link](https://github.com/facebook/docusaurus/pull/11327#issuecomment-3258897079)

> > It’s currently using our test LLM instance. We removed it to prevent it from being deployed to your production website, as we might revoke it at any time.
> 
> What if I do want to use it on our production website? 
> 
> I see the assistant here:
> 
> <img width="2752" height="492" alt="CleanShot 2025-09-05 at 18 01 57@2x" src="https://github.com/user-attachments/assets/a06d5615-f74a-4c13-946c-38692610c3fe" />
> 
> Can I create a stable assistant that we'll keep after merging? Or can I reuse the existing one and just remove the `-demo` prefix? 
> 
> Does it mean we'd need to provide an LLM API Key? Or do you eventually provide one as part of your free DocSearch offering?
> 
> How am I supposed to tell Meta that there's no Meta model available in the dropdown 😅
> Maybe you could offer us access to your OpenAI key. It may be complicated for me to convince Meta to purchase something from a competing LLM product, and it's likely in your interest if we showcase Ask AI on our own website.

### @dylantientcheu — 1 reactions  
`👍 1`  ·  [link](https://github.com/facebook/docusaurus/pull/11327#issuecomment-3284742923)

> > is CSS width: auto really useful?
> 
> can be removed, it is `auto` by default.
> 
> > should we init algolia.askAi.searchParameters.facetFilters with algolia.searchParameters.facetFilters?
> 
> Yes it is safe to do so.
> 
> > is our historical merge logic good? (it seems not, but that can be fixed in another PR)
> 
> Probably not, but it is good enough for this use case. We are working upstream to provide a more reliable facet merge strategy.

### @8bittitan — 1 reactions  
`👍 1`  ·  [link](https://github.com/facebook/docusaurus/pull/11327#issuecomment-3298099163)

> > You broke types between beta.8 and GA (indexName becoming optional requires fixes on our side). It's better to only release GA/RC once all these changes have already been made
> 
> Sorry about that! We wanted to keep it backwards compatible and just mark it as deprecated for a case such as this 😅

### @8bittitan — 1 reactions  
`👍 1`  ·  [link](https://github.com/facebook/docusaurus/pull/11327#issuecomment-3298873208)

> @slorber The `indexName` issues should be fixed from this [PR](https://github.com/algolia/docsearch/pull/2760). It moves the backwards compatibility check to within the `<DocSearchModal />` component.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
