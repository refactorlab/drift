# laurent22/joplin #11865 — All: Add SAML support

**[View PR on GitHub](https://github.com/laurent22/joplin/pull/11865)**

| | |
|---|---|
| **Author** | @ttcchhmm |
| **Status** | ✅ merged |
| **Opened** | 2025-02-20 |
| **Repo importance** | ★55,101 · 6,143 forks · score 84,668 |
| **Diff** | +1038 / −35 across 46 files |
| **Engagement** | 20 conversation · 38 inline review comments |

## Top review comments (ranked by reactions)

### @ttcchhmm — 2 reactions  
`👍 1 · 👀 1`  ·  [link](https://github.com/laurent22/joplin/pull/11865#issuecomment-2674568915)

> I got rid of the Java dependency, and replaced the schema validator with `@authenio/samlify-xmllint-wasm`, which doesn't require any native code. This allows the server image to build.

### @laurent22 — 2 reactions  
`👍 2`  ·  [link](https://github.com/laurent22/joplin/pull/11865#issuecomment-2759472335)

> Thank you for the detailed explanation, it does help. I also need to go back to your top post and check the diagram again so I understand things at a higher level before diving into the code review. I will try to do that as soon as possible and will get back to you.

### @ttcchhmm — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/laurent22/joplin/pull/11865#issuecomment-2913334589)

> Thanks for the screenshot @stenstad!
> 
> Sorry for my inactivity, but I should be able to take a proper look at the conflict next week.

### @ttcchhmm — 1 reactions  
`👍 1`  ·  [link](https://github.com/laurent22/joplin/pull/11865#issuecomment-2792054280)

> I updated my branch with your feedback. I removed the use of `x-callback-url` in favor of a code-based authentication flow, like the way Dropbox works. I did it that way to keep the same experience between the desktop and mobile clients.
> 
> This required additional modifications to the server side of things to handle auth codes (mostly `UserModel.ts` and `api/login.ts`). I also added a new task that runs every 15 minutes that removes expired auth codes from the database.
> 
> On the clients, the removal of the `x-callback-url` based flow makes things a bit cleaner. I added a new screen dedicated to opening the login page and entering an auth code. I made it modular (it's not specific to SAML), so it's possible to port the Dropbox login screen to it in the future.
> 
> This is tested on desktop (Windows 10) and mobile (both Android and iOS).

### @laurent22 — 1 reactions  
`👍 1`  ·  [link](https://github.com/laurent22/joplin/pull/11865#issuecomment-2858895125)

> > Do I have to do something to fix the CLA CI job? I did sign the CLA when I started this pull request, so this should pass.
> 
> Sorry I missed this comment - this was a mistake on our side which is now fixed. I think we're nearly good to go with this PR. I'll do another review and let you know

### @laurent22 — 1 reactions  
`🎉 1`  ·  [link](https://github.com/laurent22/joplin/pull/11865#issuecomment-2931283902)

> The remaining failure was a random one that went away after retrying. Thanks a lot for implementing this @ttcchhmm!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
