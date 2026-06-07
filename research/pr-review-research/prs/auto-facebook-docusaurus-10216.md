# facebook/docusaurus #10216 — feat(blog): authors page

**[View PR on GitHub](https://github.com/facebook/docusaurus/pull/10216)**

| | |
|---|---|
| **Author** | @OzakIOne |
| **Status** | ✅ merged |
| **Opened** | 2024-06-13 |
| **Repo importance** | ★65,128 · 9,918 forks · score 109,787 |
| **Diff** | +1667 / −703 across 56 files |
| **Engagement** | 19 conversation · 41 inline review comments |

## Top review comments (ranked by reactions)

### @Josh-Cena — 2 reactions  
`👍 2`  ·  [link](https://github.com/facebook/docusaurus/pull/10216#issuecomment-2250932596)

> This looks like what I had in mind, but a little more spacing, especially between rows, would be great.

### @slorber — 1 reactions  
`👍 1`  ·  [link](https://github.com/facebook/docusaurus/pull/10216#issuecomment-2226804770)

> > ```ts
> > <Author {...author} />
> > ```
> 
> Author has `key` property. You shouldn't spread it, you should do `<Author author={author} />`

### @OzakIOne — 0 reactions  
`—`  ·  [link](https://github.com/facebook/docusaurus/pull/10216#issuecomment-2180928754)

> Not sure about this poc refactor [`5c789b3` (#10216)](https://github.com/facebook/docusaurus/pull/10216/commits/5c789b301c5cb32695cd371e660ef91eb3f7d089) 
> It has some side effects on the tests in `index.test.ts`
> ```
> lastUpdatedAt: undefined,
> lastUpdatedBy: undefined,
> ```
> 
> The filter of the page author is now done in getPageAuthor instead of normalizeAuthor
> 
> So now we normalize all authors, and for the pageAuthor, we get only the authors with a generatePage === true
> 
> Is it better like this or the way before ? 🤷

### @OzakIOne — 0 reactions  
`—`  ·  [link](https://github.com/facebook/docusaurus/pull/10216#issuecomment-2225714304)

> ![image](https://github.com/user-attachments/assets/4b536893-8950-4602-8dd0-319684d1f3fd)
> Fixed

### @Josh-Cena — 0 reactions  
`—`  ·  [link](https://github.com/facebook/docusaurus/pull/10216#issuecomment-2238178795)

> Can we get rid of the horizontal rules between sections? I'm also not sure if we want to group by initials—usually the initials are by last name but for obvious reasons we can't do that, and it's best if we make no assumptions about how the names should be grouped. Just sorting them should be fine since there likely won't be that many authors (I hope).
> 
> Other than that, love how it's looking at the moment :)

### @ilg-ul — 0 reactions  
`—`  ·  [link](https://github.com/facebook/docusaurus/pull/10216#issuecomment-2238199653)

> > since there likely won't be that many authors (I hope).
> 
> Here is an example:
> 
> - https://cronica-it.github.io/amintiri/autori/
> 
> Please also note that some names include diacritics, which must be replaced by non-diacritics when generating the permalinks, and possibly other non alphabetic characters, which must be removed.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
