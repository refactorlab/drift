# facebook/docusaurus #10852 — feat(theme): add `versions` attribute to `docsVersionDropdown` navbar item

**[View PR on GitHub](https://github.com/facebook/docusaurus/pull/10852)**

| | |
|---|---|
| **Author** | @hrumhurum |
| **Status** | ✅ merged |
| **Opened** | 2025-01-18 |
| **Repo importance** | ★65,128 · 9,918 forks · score 109,787 |
| **Diff** | +276 / −10 across 6 files |
| **Engagement** | 18 conversation · 14 inline review comments |

## Top review comments (ranked by reactions)

### @felipecrs — 0 reactions  
`—`  ·  [link](https://github.com/facebook/docusaurus/pull/10852#issuecomment-2913291211)

> > Also gives the ability to override version attributes (for now, only display label) by providing an object.
> 
> It would be awesome if I could override `docId` and `docsPluginId` for each version too.
> 
> This would allow me to implement my own doc versions (for example cloning the same repository multiple times and switching each to a different release branch), while still leveraging the (much nicer) `docsVersionDropdown`. Right now, I use a plain `dropdown`.

### @felipecrs — 0 reactions  
`—`  ·  [link](https://github.com/facebook/docusaurus/pull/10852#issuecomment-2964710669)

> > > Also gives the ability to override version attributes (for now, only display label) by providing an object.
> > 
> > It would be awesome if I could override `docId` and `docsPluginId` for each version too.
> > 
> > This would allow me to implement my own doc versions (for example cloning the same repository multiple times and switching each to a different release branch), while still leveraging the (much nicer) `docsVersionDropdown`. Right now, I use a plain `dropdown`.
> 
> Would you accept a PR for this, @slorber?

### @slorber — 0 reactions  
`—`  ·  [link](https://github.com/facebook/docusaurus/pull/10852#issuecomment-2965948283)

> I'm not sure to understand but this seems weird to me. The versions dropdown is tightly coupled to a specific docs plugin instance and is not meant to be used across multiple docs plugins.
> 
> I would need a concrete example to understand the use case, can you create a repro and showing how it's less convenient to use a regular hardcoded dropdown?

### @felipecrs — 0 reactions  
`—`  ·  [link](https://github.com/facebook/docusaurus/pull/10852#issuecomment-2973539703)

> Thanks a lot for replying, @slorber.
> 
> The short explanation of my use case is:
> 
> 1. My markdown docs lives in the same repository as my product
> 2. My product has several branches (example: `master`, `1.0`, `2.0`, `3.0`)
> 3. The idea of keeping documentation for all versions within `master` branch does work for me, the docs are kept up to date for each branch as these product versions are also kept receiving maintenance changes 
> 4. I need Docusaurus to read the docs from each branch instead
> 
> Since Docusaurus has no such feature (reading docs versions from `git` branches), I'm doing a trick in my build process to have the same repository cloned multiple times in different directories and each of  them pointing to a version branch.
> 
> Then, I create one `docInstance` for each of these directories.
> 
> It works great, but when compared to the regular "multiple versions" experience:
> 
> 1. The dropdown does not reflect the current version that is selected when collapsed
> 2. There's no banner indicating _you are viewing docs for an older version_
> 3. There're no tags within the pages indicating which version the current document applies to
> 
> I can build a minimal sample repository if you want to play with this concept. Would you still like it?

### @slorber — 0 reactions  
`—`  ·  [link](https://github.com/facebook/docusaurus/pull/10852#issuecomment-2975844624)

> > 3. The idea of keeping documentation for all versions within `master` branch does work for me, the docs are kept up to date for each branch as these product versions are also kept receiving maintenance changes
> > 4. I need Docusaurus to read the docs from each branch instead
> 
> This seems contradictory to me: you either have the versioned docs on master, or on dedicated feature branches, not both at the same time? 🤔 
> 
> ---
> 
> > Since Docusaurus has no such feature (reading docs versions from `git` branches), I'm doing a trick in my build process to have the same repository cloned multiple times in different directories and each of them pointing to a version branch.
> 
> Docusaurus doesn't care about Git and branches. It sees what you have on the filesystem and builds that. 
> 
> > Then, I create one `docInstance` for each of these directories.
> 
> The docs version dropdown is meant to be used within a single docs instance. 
> 
> If you want to use it, you must put your versioned docs in `versioned_docs`, and not use separate instances. 
> 
> If you want to support your specific use case, you would have to create your own navbar component, or compute a dynamic regular dropdown with code.
> 
> > It works great, but when compared to the regular "multiple versions" experience:
> > 
> > 1. The dropdown does not reflect the current version that is selected when collapsed
> > 2. There's no banner indicating _you are viewing docs for an older version_
> > 3. There're no tags within the pages indicating which version the current document applies to
> > 
> > I can build a minimal sample repository if you want to play wit … *[truncated]*

### @felipecrs — 0 reactions  
`—`  ·  [link](https://github.com/facebook/docusaurus/pull/10852#issuecomment-2977008662)

> > This seems contradictory to me: you either have the versioned docs on master, or on dedicated feature branches, not both at the same time? 🤔
> 
> I have docs for version `master` in the `master` branch. And I have docs for version `1.0` in the `1.0` branch. I hope that clarifies it. 😅
> 
> ---
> 
> @slorber I read everything you wrote (thank you!) and I started evaluating whether I could simply automatically build the `versioned_docs` directory and `versions.json` through my build script.
> 
> The answer is: for some simpler cases, it's probably doable. For me, it is not, because my `docs` directory make references to files outside of the `docs` directory, but still within that same branch (code snippets using raw loader for example).
> 
> ---
> 
> That said, I think the only thing I really need is to be able to override the versioned docs path and their edit URLs through the `versions.json`. Something like:
> 
> ```json
> [
>   "2.0": {
>     "docsPath": "../my-repo-2.0/docs",
>     "editUrl": "https://github.com/my-company/my-repo/tree/2.0/docs/"
>   },
>   "1.0": {
>     "docsPath": "../my-repo-1.0/docs",
>     "editUrl": "https://github.com/my-company/my-repo/tree/1.0/docs/"
>   }
> ]
> ```
> 
> And then I could leverage native support for versioned docs.
> 
> What do you think?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
