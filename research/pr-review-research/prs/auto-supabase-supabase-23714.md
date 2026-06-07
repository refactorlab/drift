# supabase/supabase #23714 — feature: warehouse

**[View PR on GitHub](https://github.com/supabase/supabase/pull/23714)**

| | |
|---|---|
| **Author** | @jordienr |
| **Status** | ✅ merged |
| **Opened** | 2024-05-03 |
| **Repo importance** | ★103,613 · 12,649 forks · score 159,209 |
| **Diff** | +2057 / −142 across 40 files |
| **Engagement** | 19 conversation · 80 inline review comments |

## Top review comments (ranked by reactions)

### @saltcod — 1 reactions  
`👍 1`  ·  [link](https://github.com/supabase/supabase/pull/23714#issuecomment-2122880945)

> Can we show a better empty state here based on some conditions? I get the "No results" make sense sometimes — but if I have no records and no access tokens maybe I could show something else? Links to docs, etc. Maybe something like the Edge Functions empty state — some docs, some text, some instructions.
> 
> ![screenshot-2024-05-21-at-12 50 41](https://github.com/supabase/supabase/assets/105593/4a0ec4ac-4876-4d05-9752-94cb3d42654b)

### @saltcod — 1 reactions  
`👍 1`  ·  [link](https://github.com/supabase/supabase/pull/23714#issuecomment-2122897519)

> weird delete collection behavour. It actually worked, but didn't look like it. 
> 
> ![screenshot-2024-05-21-at-13 00 29](https://github.com/supabase/supabase/assets/105593/6a4157d7-7979-4af4-8df7-5ab180b72f4e)

### @saltcod — 1 reactions  
`👍 1`  ·  [link](https://github.com/supabase/supabase/pull/23714#issuecomment-2122901797)

> A "NEW" badge would be good here
> 
> ![screenshot-2024-05-21-at-13 02 55](https://github.com/supabase/supabase/assets/105593/7ab0f85b-2ecf-49fc-9124-d7be7b52f1d4)

### @joshenlim — 0 reactions  
`—`  ·  [link](https://github.com/supabase/supabase/pull/23714#issuecomment-2121872740)

> There's some excess border happening here in the warehouse access token table
> <img src="https://github.com/supabase/supabase/assets/19742402/0520f951-03df-4347-902d-f9b588137705" width="200" />
> 
> also - the UX feels weird when we click "Access token", it feels like im taken to a new page, but the nav context is missing from the side menu. I'll collate the UX comments separately though, we can address them separately since this UI is feature flagged

### @joshenlim — 0 reactions  
`—`  ·  [link](https://github.com/supabase/supabase/pull/23714#issuecomment-2121881618)

> excess spacing here - the divider should be across the component i think
> <img src="https://github.com/supabase/supabase/assets/19742402/2c5f4808-77e2-41fe-b28d-b1f8ce91603f" width="400" />

### @joshenlim — 0 reactions  
`—`  ·  [link](https://github.com/supabase/supabase/pull/23714#issuecomment-2121900931)

> I reckon we don't put the checkbox as a confirmation - lets be consistent in our UI across the pages, can refer to SQL editor delete query modal for example (using red button as an indicator that this action is destructive). If let's say we really want to add some validation to confirm the deletion, then lets follow the delete project UX where there's a text confirmation to type in the collection name
> 
> ![image](https://github.com/supabase/supabase/assets/19742402/11f81af0-80a0-4f8f-ba98-427c733355d1)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
