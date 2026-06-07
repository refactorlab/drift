# dani-garcia/vaultwarden #4386 — Change API and structs to camelCase

**[View PR on GitHub](https://github.com/dani-garcia/vaultwarden/pull/4386)**

| | |
|---|---|
| **Author** | @dani-garcia |
| **Status** | ✅ merged |
| **Opened** | 2024-02-28 |
| **Repo importance** | ★61,897 · 2,883 forks · score 78,170 |
| **Diff** | +1953 / −2006 across 37 files |
| **Engagement** | 89 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @dani-garcia — 34 reactions  
`👍 6 · ❤️ 18 · 🎉 2 · 🚀 7 · 😄 1`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/4386#issuecomment-2181335334)

> I fixed an issue with Sends sending their size as a integer instead of a string, which was breaking the ios app, also fixed the issue mentioned with twofactorproviders being sent as ints too

### @dani-garcia — 25 reactions  
`👍 10 · ❤️ 10 · 🎉 2 · 🚀 3`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/4386#issuecomment-2185313928)

> I see there's a lot of interest in this issue so for anyone who's following this, the docker images including this PR are now available at the `vaultwarden/server:testing` and  `vaultwarden/server:testing-alpine` tags. Please let us know if you find any issues with them. Thanks!

### @dani-garcia — 16 reactions  
`👍 16`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/4386#issuecomment-2177251070)

> Native apps are available in beta now, so we should try getting this merged soon: 
> https://fosstodon.org/@bitwarden/112639925158165590
> https://community.bitwarden.com/t/about-the-beta-program/39185

### @albatrosify — 13 reactions  
`👍 3 · ❤️ 5 · 🎉 2 · 🚀 2 · 😄 1`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/4386#issuecomment-2183091485)

> I can confirm this solves the issue I had with sends.

### @dani-garcia — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/4386#issuecomment-2178991568)

> Okay, sends should be fixed and changed to lowercase now, and the admin templates are updated too.
> 
> I've also updated the org revoke API endpoint which was using `Ids` as key too.

### @felixoswald — 3 reactions  
`👍 2 · 🚀 1`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/4386#issuecomment-2188061049)

> Can confirm. PDF and other attachments work fine in the web interface (latest testing) and in the iOS beta app (2024.6.1 1151 @ iOS 18.0).


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
