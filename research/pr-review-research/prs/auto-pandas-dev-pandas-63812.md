# pandas-dev/pandas #63812 — DOC: Add py:type reference targets to pandas.api.typing.aliases

**[View PR on GitHub](https://github.com/pandas-dev/pandas/pull/63812)**

| | |
|---|---|
| **Author** | @sanrishi |
| **Status** | ✅ merged |
| **Opened** | 2026-01-22 |
| **Repo importance** | ★48,910 · 19,993 forks · score 133,847 |
| **Diff** | +146 / −70 across 1 files |
| **Engagement** | 81 conversation · 83 inline review comments |

## Top review comments (ranked by reactions)

### @flying-sheep — 1 reactions  
`😄 1`  ·  [link](https://github.com/pandas-dev/pandas/pull/63812#issuecomment-3792727178)

> Lol, I’ve just spent wayy too much time debugging Sphinx docs. I’m usually not sad, I just just know that I'm often the only guy around who knows how everything works together.
> 
> That's why I sometimes just say “do this thing”: because I know it's the only thing that makes sense.

### @sanrishi — 1 reactions  
`👎 1`  ·  [link](https://github.com/pandas-dev/pandas/pull/63812#issuecomment-3798004197)

> Thanks for the suggestion! @flying-sheep However, Dr-Irv explicitly requested to avoid using directives inside the table to ensure the layout remains stable and readable.
> 
>  I am sticking to the standard backticks approach becsuse In reStructuredText, "Simple Tables" (the ones with ====) are designed for simple text.
> 
> You generally cannot put block-level directives (like .. type::) inside them reliably. It usually breaks the table structure or renders literally as text .. type:: .

### @flying-sheep — 1 reactions  
`😄 1`  ·  [link](https://github.com/pandas-dev/pandas/pull/63812#issuecomment-3800678908)

> > One is to have the "out-links" (link targets) that are in the second column of the table in the page pandas.pydata.org/docs/dev/reference/aliases.html point to the docs for the various methods and classes.
> 
> Not really what I came here fore, that’s just me being nice and fixing a few broken links, hopefully in the process teaching someone by example how this all works!
> 
> > The second thing is to list the aliases properly as types so that they can be linked to from elsewhere.
> 
> Yes, that’s what the issue I filed is for!

### @flying-sheep — 1 reactions  
`👀 1`  ·  [link](https://github.com/pandas-dev/pandas/pull/63812#issuecomment-3804077110)

> > your broken links
> 
> Not mine. As said: my PR fixes some of the broken links that already existed. So you fixed some more? That’s great!
> 
> But I think that’ll be easier to do after my PR is merged, otherwise you get merge conflicts because you’re changing the same lines.
> 
> > I have ready the best version of my pr to fix the issue
> 
> Idk man, you kept ignoring what I said must be done until I did it myself, then you copied all of it and fixed some links on top. Which as I said is great, but not really what we came here for (defining targets)
> 
> I’m fine with us being co-authors here if the maintainers decide to merge this PR instead of mine. @Dr-Irv @rhshadrach: you know how to do that right?

### @Dr-Irv — 1 reactions  
`👍 1`  ·  [link](https://github.com/pandas-dev/pandas/pull/63812#issuecomment-3805870438)

> > As said, I’m totally OK if this one gets merged with me tagged as co-author in the way GitHub does it.
> 
> @flying-sheep Thanks for your help in this. When I merge, I'll make sure you get attribution as well.  Do you want to close #63877 ?

### @Dr-Irv — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/pandas-dev/pandas/pull/63812#issuecomment-3828930533)

> @sanrishi  It seems the preview isn't always working.  But here is what you can do to see the results, if you're not doing a local build of the docs.  In the CI, there is a workflow "Doc Build and Upload".  If you click on the details, there is a step "Save website as an artifact".  If you expand that, there will be a link to the artifact, which you can download.  It will be a ZIP file of the built docs.  You can unzip that and then open the `aliases.html` file to see what it looks like.
> 
> When I do that, I see things like this:
> <img width="702" height="139" alt="image" src="https://github.com/user-attachments/assets/4272195e-9239-4969-bd36-fc748c44a8ec" />
> 
> The issue here is that `read_csv()` should be `pandas.read_csv()` not `pandas.DataFrame.read_csv()`, but what you did for `to_html()` is correct.
> 
> So by doing this, you can then see how to get all the links to be correct.
> 
> Another option is to follow the instructions to create a development environment here:  https://pandas.pydata.org/docs/dev/development/contributing_environment.html followed by the instructions on how to build single pages here:  https://pandas.pydata.org/docs/dev/development/contributing_documentation.html#building-the-documentation
> 
> When I did the command `python make.py --single reference/aliases.rst` it built the page and opened a browser to that page, so that's probably a quicker way to see if things are working correctly.
> 
> I'm not expecting you to get all of these converted to correct links.  But any *changes* you make need to be correct.  That's how I will validate the PR.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
