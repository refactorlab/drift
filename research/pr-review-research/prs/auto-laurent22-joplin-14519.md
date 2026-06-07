# laurent22/joplin #14519 — Desktop: Resolves #12372: Add table editing commands (add/delete rows and columns)

**[View PR on GitHub](https://github.com/laurent22/joplin/pull/14519)**

| | |
|---|---|
| **Author** | @kanishka0411 |
| **Status** | ✅ merged |
| **Opened** | 2026-03-02 |
| **Repo importance** | ★55,101 · 6,143 forks · score 84,668 |
| **Diff** | +1970 / −11 across 22 files |
| **Engagement** | 40 conversation · 15 inline review comments |

## Top review comments (ranked by reactions)

### @bwat47 — 2 reactions  
`👍 2`  ·  [link](https://github.com/laurent22/joplin/pull/14519#issuecomment-4144270506)

> I do see a few remaining issues:
> 
> 1\. If one cell in the row has line wrapping (increasing the height of the row), when left clicking other cells (that contain less text), the cell editor doesn't activate unless you specifically click on the first "line":
> 
> ![test2](https://github.com/user-attachments/assets/003c8889-d1f6-4fd7-bb8a-57519b67dd15)
> 
> 2\. tab can sometimes cause the cursor to jump to a cell in another table:
> 
> note: adding a new row can cause this too, seen in the next example
> 
> ![test3](https://github.com/user-attachments/assets/efdc2e68-c1f7-4caa-a813-d2911cfdbe98)
> 
> 3\. making a structural change (adding new row/col) can unescape an escaped pipe in table cell content:
> 
> ![test4](https://github.com/user-attachments/assets/40a40fe5-c099-4624-bd70-5eeaa8a76e1d)
> 
> 4\. Not sure what happened here as I stumbled acrross this when trying to demonstrate the line wrapping behavior and couldn't re-create again, but I saw an issue where trying to click another table cell broke the table widget revealing the markdown:
> 
> ![test1](https://github.com/user-attachments/assets/1a140152-5469-4c1b-8dbc-d2c7690e513e)

### @kanishka0411 — 2 reactions  
`👍 2`  ·  [link](https://github.com/laurent22/joplin/pull/14519#issuecomment-4157781535)

> Hey! Fixed the issues you pointed out :-)
> 
> * Cell click in tall rows- fixed, clicking anywhere in the cell now activates the editor
> * Tab jumping to another table -fixed, Tab/focus is now scoped to the current table
> * Escaped pipes - fixed, pipes are preserved through edits and structural changes
> * Intermittent widget break -couldn't reproduce but the scoping fix for Tab jumping to another table should help since it removes stale DOM references
> 
> https://github.com/user-attachments/assets/63de680c-4712-45b9-8e60-5558c4212ebb

### @laurent22 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/laurent22/joplin/pull/14519#issuecomment-4081194220)

> @kanishka0411, are you still ok completing this PR? If so, please also make sure to add a video once it's done

### @laurent22 — 1 reactions  
`👍 1`  ·  [link](https://github.com/laurent22/joplin/pull/14519#issuecomment-4103179215)

> Thanks for the update. It seems to mostly work but it's a bit flaky and there are issues:
> 
> - It adds some buttons to add/remove rows and columns to the toolbar, but obviously those don't do anything if you're not in a table. Maybe they can just be removed and the controls would appear only when a table is being edited?
> 
> - A bigger problem is that if I click on "+" within a table to add a row or column, it displays the table as text and I need to click out of it to bring back the rendering (see below)
> 
> - There should be a way to create a table, like there is in the RTE. In fact it's probably good to look at how the RTE manages this since the table editing feature is very good
> 
> So as it is, it's probably 80% there but it would need some refinement to be usable.
> 
> https://github.com/user-attachments/assets/82aadfce-f66f-4850-bfe6-cb32956fad4d

### @bwat47 — 1 reactions  
`👍 1`  ·  [link](https://github.com/laurent22/joplin/pull/14519#issuecomment-4118935558)

> a few issues I noticed:
> 
> 1\. Creating a new column > typing text into that new column header > then clicking create new column again will lose the text that was typed into the previous column header
> 
> Note: the same issue happens with row creation, seen at 11s in the above video
> 
> 2\. entering newlines in the cell editor (shift + enter) and then hitting tab (so the cell changes are sync'd) inserts the newline into the table (potentially breaking the table). 
> 
> Newlines aren't allowed inside markdown table cells, so it would need to either convert the newlines to `<br>` (most common behavior with markdown table editors), or not allow newlines to be entered.
> 
> 3\. typing a pipe into the cell editor doesn't automatically escape the pipe, which can break the table (as pipes are table delimiters)
> 
> 4\. In wide tables, you are often unable to click into specific table cells towards the right side of the table. 
> 
> This seems related to scenarios where the table widget is wider than the editor width. I can still re-create this with a wide enough table when Max Editor width is set to 0, but the easiest way to re-create it to set a small max editor width (e.g. 600px) under Tools | options | editor.
> 
> Note: tabbing through cells with keyboard seems able to activate the cells without issue
> 
> 5\. When a max editor width is set, the rendered table widget can appear wider than the configured max editor width.
> 
> 6\. After creating a new row/column, the cursor is no longer focused in any cell in the table widget. Positioning the cursor in the appropriate table cell after creating a row/column might … *[truncated]*

### @bwat47 — 1 reactions  
`👍 1`  ·  [link](https://github.com/laurent22/joplin/pull/14519#issuecomment-4173794701)

> 1\. There still seems to be some oddities with pipes, if a table cell contains an escaped pipe, creating a new column (with the cursor in that cell) can cause rows to be created instead of a column:
> 
> ![test4](https://github.com/user-attachments/assets/f6e07057-9c54-4186-b0f7-d80136603dbf)
> 
> 2\. If you hit tab too quickly after typing content into the last cell, an extra row can be created (containing the content of the cell you were typing into):
> 
> ![test5](https://github.com/user-attachments/assets/36053213-eb2a-4db3-a9e8-b964ce49dd3c)
> 
> 3\. The right click context menu can go off screen if invoked near the edge of the editor:
> 
> <img width="1966" height="826" alt="image" src="https://github.com/user-attachments/assets/d839c18e-dc8a-4d1f-a6b1-ef0a61d874ce" />


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
