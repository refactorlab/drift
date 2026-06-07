# laurent22/joplin #14818 — Mobile: Resolves #14789: Implement note attachments management screen

**[View PR on GitHub](https://github.com/laurent22/joplin/pull/14818)**

| | |
|---|---|
| **Author** | @yousef-genedy |
| **Status** | ✅ merged |
| **Opened** | 2026-03-18 |
| **Repo importance** | ★55,101 · 6,143 forks · score 84,668 |
| **Diff** | +690 / −2 across 10 files |
| **Engagement** | 33 conversation · 33 inline review comments |

## Top review comments (ranked by reactions)

### @laurent22 — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/laurent22/joplin/pull/14818#issuecomment-4110284825)

> Ok I think that looks good, thanks @yousef-genedy

### @mrjo118 — 1 reactions  
`👍 1`  ·  [link](https://github.com/laurent22/joplin/pull/14818#issuecomment-4083539755)

> > I think we can make it smaller and to be in the same vertical column of the copy button, what do you think ?
> 
> Sounds good to me. And use a trash can icon instead of the word delete

### @yousef-genedy — 1 reactions  
`👍 1`  ·  [link](https://github.com/laurent22/joplin/pull/14818#issuecomment-4093040558)

> > I think the point was the row was already tall before and there is no limit to how long the name can be. But if you limit it to 2 lines then it should be fine now that the row is not so tall anymore
> 
> you mean like this ?
> 
> <img width="350" alt="image" src="https://github.com/user-attachments/assets/b74dd420-56c1-44af-b3fb-339800bd2006" />

### @yousef-genedy — 1 reactions  
`👍 1`  ·  [link](https://github.com/laurent22/joplin/pull/14818#issuecomment-4093058127)

> > Could pressing the resource title or whole line expand and collapse it? Which could move the delete and copy buttons and display the info in more space?
> 
> the pressing action actually opens the attachment itself
> 
> I have another idea, can we remove the copy icon and trash icon from the row itself, and when user long press the resource there is a dropdown that is appeared and have two options (copy and delete)
> this will allow the line to be long and will contain (possibly) any title, what do you think ?

### @mrjo118 — 1 reactions  
`👍 1`  ·  [link](https://github.com/laurent22/joplin/pull/14818#issuecomment-4101872483)

> > Here is the latest state about the long press behavior, notice the following
> > 
> >     * when long press row is expanded/collapsed
> > 
> >     * when searching the state is reseted
> > 
> >     * the state if many expanded rows is persisted using resource id
> > 
> >     * the sorting doesn't change the behavior of the expanded/collapsed rows
> > 
> > 
> > expand_collapse_behavior.mp4
> 
> Looks good to me! I'm going to pass on reviewing the code though as it's pretty big. I'll leave that to Laurent

### @laurent22 — 0 reactions  
`—`  ·  [link](https://github.com/laurent22/joplin/pull/14818#issuecomment-4083388638)

> That feels a lot like AI generated code that has not been reviewed in depth. Probably took me longer to review this that it did to generate it.
> 
> For the UI we need to make it more compact:
> 
> <img width="279" height="169" alt="image" src="https://github.com/user-attachments/assets/e9fadd99-b500-4cf5-b194-a81eb1f8f8c2" />
> 
> - Title should be bold
> - It should crop with elipsis (and not wrap) if too long
> - Title label should be removed
> - Is the ID necessary?
> - Size can be displayed below the title without the "size" label
> - This big "Delete" button on each resource doesn't look good and take a lot of space - any better way to do this?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
