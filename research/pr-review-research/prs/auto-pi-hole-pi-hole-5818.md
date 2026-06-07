# pi-hole/pi-hole #5818 — Gravity database resilience

**[View PR on GitHub](https://github.com/pi-hole/pi-hole/pull/5818)**

| | |
|---|---|
| **Author** | @DL6ER |
| **Status** | ✅ merged |
| **Opened** | 2024-11-16 |
| **Repo importance** | ★59,134 · 3,215 forks · score 76,939 |
| **Diff** | +132 / −29 across 2 files |
| **Engagement** | 18 conversation · 10 inline review comments |

## Top review comments (ranked by reactions)

### @DL6ER — 1 reactions  
`👍 1`  ·  [link](https://github.com/pi-hole/pi-hole/pull/5818#issuecomment-2509588372)

> > 10? Can we cap it at 3 or so?
> 
> We could but this offers a simple way of "going" back in case users have deleted stuff accidentally. A backup gravity file wights around 50 KB even with a few hundred manual lists and the vacuum process is needed only once.
> 
> > How resource intensive is the vacuum process? Will this impact low memory, slow single core setups?
> 
> It is a very easy task requiring less than 150 KB of memory. On my small `x86_64` microserver, the process takes less than a millisecond. As the possibly multi-million entries table `gravity` is *not* included in the backup, I expect no performance differences even for users running possibly dozens of millions of blocked domains.

### @yubiuser — 1 reactions  
`👍 1`  ·  [link](https://github.com/pi-hole/pi-hole/pull/5818#issuecomment-2567000922)

> This needs to be rebased on `development`

### @DL6ER — 0 reactions  
`—`  ·  [link](https://github.com/pi-hole/pi-hole/pull/5818#issuecomment-2494410890)

> I disagree on "fail hard" as, currently, it goes together with **(unrecoverable) data loss** which can really upset users and make them migrate away from Pi-hole. Assume what you might be doing when you are only a user, maybe invested a lot of time and effort into your multi-million blocked domains collection and also spent nights collecting regular expressions online in some shady forums. I don't think gravity should ever loose its content but current it can - and watching/reading Discourse this happens at least on the order of once per week. And these are only the users that do the extra lengths of creating an account and asking for help.
> 
> We *could* remove the automated recovery mode and only offer it through manual `pihole -g --repair` or something but I don't really see the benefit and - very probably - it would take even a few lines code in addition. This change comes at about 50 additional lines if you strip existing code that is just moved around and comments - and I don't think it adds any complicated logic (like crazy `awk` stuff, etc.) to the file.

### @yubiuser — 0 reactions  
`—`  ·  [link](https://github.com/pi-hole/pi-hole/pull/5818#issuecomment-2494716601)

> > I disagree on "fail hard" as, currently, it goes together with (unrecoverable) data loss which can really upset users and make them migrate away from Pi-hole. Assume what you might be doing when you are only a user, maybe invested a lot of time and effort into your multi-million blocked domains collection and also spent nights collecting regular expressions online in some shady forums. I don't think gravity should ever loose its content but current it can - and watching/reading Discourse this happens at least on the order of once per week. And these are only the users that do the extra lengths of creating an account and asking for help.
> 
> I get your point, but still think we should let users when know if there were any issues that needed a backup replacement. Can we add warning to the `message` table at least?

### @DL6ER — 0 reactions  
`—`  ·  [link](https://github.com/pi-hole/pi-hole/pull/5818#issuecomment-2495402690)

> ![image](https://github.com/user-attachments/assets/e6996112-dcd4-4555-9877-d8aec13bc964)
> 
> together with https://github.com/pi-hole/FTL/pull/2122

### @PromoFaux — 0 reactions  
`—`  ·  [link](https://github.com/pi-hole/pi-hole/pull/5818#issuecomment-2508660501)

> So, this only kicks in when `gravity.db` is corrupted beyond help, right? We're not likely to overwrite a known-good `gravity.db` with an older one?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
