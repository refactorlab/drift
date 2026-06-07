# mozilla/pdf.js #19043 — Add logic to track rendering area of various PDF ops

**[View PR on GitHub](https://github.com/mozilla/pdf.js/pull/19043)**

| | |
|---|---|
| **Author** | @nicolo-ribaudo |
| **Status** | ✅ merged |
| **Opened** | 2024-11-14 |
| **Repo importance** | ★53,401 · 10,625 forks · score 100,897 |
| **Diff** | +2558 / −212 across 17 files |
| **Engagement** | 95 conversation · 10 inline review comments |

## Top review comments (ranked by reactions)

### @nicolo-ribaudo — 1 reactions  
`👍 1`  ·  [link](https://github.com/mozilla/pdf.js/pull/19043#issuecomment-2549094436)

> https://github.com/mozilla/pdf.js/compare/master...nicolo-ribaudo:pdf.js:draw-page-portion-optimized is a branch merging this PR together with https://github.com/mozilla/pdf.js/pull/19128. In the video below you can see that it first renders in the background a low-resolution image "the old way" taking 12 seconds, and then it renders the "detail view" on top taking only 1.4 seconds and only running one fifth of the PDF operations :)
> 
> https://github.com/user-attachments/assets/f4d1886e-4778-4c20-8e70-6405148c251e
> 
> Still keeping this as draft because there are significant bugs (in the PDF I'm using for testing, it often skips rendering some pieces of text even if they are visible on screen, or it renders some paths with the wrong color), but it's nice to see some progress.

### @bobsingor — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/19043#issuecomment-2566963262)

> Very good progress on this! This is a feature that the community is waiting a long time for. Can't wait to see more progress on this.

### @nicolo-ribaudo — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/19043#issuecomment-2930898196)

> Update!
> 
> - I've reworked the dependency tracking to be based on PDF operations rather than on canvas operations. Doing it on canvas operations originally seemed cleaner, but it introduces a lot of complexity because each PDF op calls many canvas ops, and they read state from the canvas in a way that caused the tracking logic to loose information of where that state was _originally_ coming from.
> - I've now hooked it up to the "detail view" logic, so that we record dependencies/bboxes while rendering the background page and then use that information when rendering the detail view.
> 
> This video shows how we are skipping some ops while rendering the detail view as we scroll around the page :)
> 
> https://github.com/user-attachments/assets/cab8ce0a-c658-4094-b78b-9ae6818b37bd
> 
> The main missing task is that I have to properly hook this logic up to the reftests, maybe rendering a fraction of the page with the logic and checking that it matches the same fraction of the page with the unoptimized rendering. Once this is done, I can go through the failing tests one by one and add the missing tracking.

### @nicolo-ribaudo — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/19043#issuecomment-3150028741)

> There are two failures in the new tests:
> - issue8078-partial
> - intelisa-84-partial
> 
> They only happen in headless Firefox, and not in "full" Firefox or in Chrome, and the diff is that black lines are very slightly thicker. Any idea of what it could be?

### @nicolo-ribaudo — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/19043#issuecomment-3206873620)

> Should I rebase to pick up your firefox downgrade, or do the bots do it automatically?
> 
> Fwiw, with the debugging commits running locally I'm noticing that when it gets stuck even the `/iAmAlive` endpoint stops being hit, as if the browser just disappears (and it's not something taking very long).

### @nicolo-ribaudo — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/19043#issuecomment-3206878805)

> Oh well, this is interesting... Now most failures are due to reference mismatches for the non-partial tests 😅


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
