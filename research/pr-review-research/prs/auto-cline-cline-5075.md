# cline/cline #5075 — feat: OCA provider

**[View PR on GitHub](https://github.com/cline/cline/pull/5075)**

| | |
|---|---|
| **Author** | @nihar-oracle |
| **Status** | ✅ merged |
| **Opened** | 2025-07-21 |
| **Repo importance** | ★62,798 · 6,613 forks · score 94,248 |
| **Diff** | +1409 / −9 across 25 files |
| **Engagement** | 18 conversation · 112 inline review comments |

## Top review comments (ranked by reactions)

### @celestial-vault — 6 reactions  
`👍 2 · ❤️ 1 · 🎉 2 · 🚀 1`  ·  [link](https://github.com/cline/cline/pull/5075#issuecomment-3293437450)

> @kefayati Let's merge this PR first and then circle back.

### @kefayati — 1 reactions  
`👍 1`  ·  [link](https://github.com/cline/cline/pull/5075#issuecomment-3122700182)

> > Is there no way that this can be simplified for the time being? Moving forward, we can set up a communication channel to discuss prioritizing some of these other methods. Potentially you can look to the SAP Provider for inspiration.
> 
> We have made an effort to make it as simple as possible. We have looked into SAP's implementation as well. Happy to establish the long term communication channel since our team is investing code assist and code agents for Oracle users and customers alike. Feel free to let us know what is your preferred method of communication and I get it going. I am fairly visible in LinkedIn and we can get started from there.

### @celestial-vault — 1 reactions  
`👍 1`  ·  [link](https://github.com/cline/cline/pull/5075#issuecomment-3133283324)

> > > Is there no way that this can be simplified for the time being? Moving forward, we can set up a communication channel to discuss prioritizing some of these other methods. Potentially you can look to the SAP Provider for inspiration.
> > 
> > We have made an effort to make it as simple as possible. We have looked into SAP's implementation as well. Happy to establish the long term communication channel since our team is investing code assist and code agents for Oracle users and customers alike. Feel free to let us know what is your preferred method of communication and I get it going. I am fairly visible in LinkedIn and we can get started from there.
> 
> @kefayati Added you

### @gbohus — 0 reactions  
`—`  ·  [link](https://github.com/cline/cline/pull/5075#issuecomment-3104203986)

> Would love to see Oracle OCA provider be added, super useful and needed in the industry!!!!

### @nihar-oracle — 0 reactions  
`—`  ·  [link](https://github.com/cline/cline/pull/5075#issuecomment-3104770337)

> > Looking good!
> > 
> > Let's make some changes based on the above comments.
> > 
> > As to the authentication, can we get it consolidated as much as possible?
> 
> Hey, Thanks @celestial-vault 
> 
> I responded to all your changes, updated the description and am working through the implementation.
> Would like some clarification on a couple of them (mainly names), please feel free to respond at 
> I just have a question about the auth consolidation piece of it.
> Since oca relies on pkce oauth and access keys instead of api keys, it needs certain services like log in, log out and refresh.
> 
> I understand that it might not be possible to have separate oca.proto, would you prefer to include it within the account.proto instead?
> 
> Please let me know

### @nihar-oracle — 0 reactions  
`—`  ·  [link](https://github.com/cline/cline/pull/5075#issuecomment-3110157278)

> @celestial-vault just checking in about some of the questions in my response


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
