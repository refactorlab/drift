# pi-hole/pi-hole #6275 — Alpine Linux Support and Tests

**[View PR on GitHub](https://github.com/pi-hole/pi-hole/pull/6275)**

| | |
|---|---|
| **Author** | @mgziminsky |
| **Status** | ✅ merged |
| **Opened** | 2025-06-03 |
| **Repo importance** | ★59,134 · 3,215 forks · score 76,939 |
| **Diff** | +209 / −12 across 11 files |
| **Engagement** | 30 conversation · 40 inline review comments |

## Top review comments (ranked by reactions)

### @PromoFaux — 3 reactions  
`👍 3`  ·  [link](https://github.com/pi-hole/pi-hole/pull/6275#issuecomment-3236847764)

> In `development`, yes, but not released yet.

### @thebream — 2 reactions  
`👍 2`  ·  [link](https://github.com/pi-hole/pi-hole/pull/6275#issuecomment-3454527016)

> Great work!
> 
> Might need to update this page now then:
> https://docs.pi-hole.net/main/prerequisites/#supported-operating-systems

### @PromoFaux — 2 reactions  
`👍 2`  ·  [link](https://github.com/pi-hole/pi-hole/pull/6275#issuecomment-3464121339)

> https://github.com/pi-hole/docs/pull/1301

### @mgziminsky — 1 reactions  
`👍 1`  ·  [link](https://github.com/pi-hole/pi-hole/pull/6275#issuecomment-3067317597)

> > Problem seems to be that pihole-FTL-poststop script is stored in /opt/pihole, which is deleted here:
> > 
> > Before the call to pihole-FTL-poststop via:
> 
> This isn't specific to my branch and is an issue in the base repo. A fix for this probably deserves its own PR. All the deletions should probably be moved to the bottom of that function

### @mgziminsky — 1 reactions  
`👍 1`  ·  [link](https://github.com/pi-hole/pi-hole/pull/6275#issuecomment-3175832551)

> The uninstall issue was discussed previously https://github.com/pi-hole/pi-hole/pull/6275#issuecomment-3062799933, that is what #6339 is addressing.

### @vosi — 1 reactions  
`👍 1`  ·  [link](https://github.com/pi-hole/pi-hole/pull/6275#issuecomment-3329978523)

> > where can I track the release for that? Thank you for your hard work!
> 
> here, i believe it will arrive with the next release.    
> https://github.com/pi-hole/pi-hole/releases


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
