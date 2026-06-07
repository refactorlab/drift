# FuelLabs/sway #7143 — feat: implement `forc add` and `forc remove` to add/remove dependencies

**[View PR on GitHub](https://github.com/FuelLabs/sway/pull/7143)**

| | |
|---|---|
| **Author** | @JoE11-y |
| **Status** | ✅ merged |
| **Opened** | 2025-05-03 |
| **Repo importance** | ★61,652 · 5,423 forks · score 88,314 |
| **Diff** | +1724 / −31 across 14 files |
| **Engagement** | 15 conversation · 115 inline review comments |

## Top review comments (ranked by reactions)

### @zees-dev — 1 reactions  
`👍 1`  ·  [link](https://github.com/FuelLabs/sway/pull/7143#issuecomment-2849721108)

> You may also want to integrate with the `forc.pub` registry - which would be a canonical endpoint to add dependencies.
> ^ Or an issue should be created to integrate with `forc.pub` registry - if this is to be done in a future PR.
> Thoughts @sdankel, @kayagokalp?

### @JoshuaBatty — 1 reactions  
`🚀 1`  ·  [link](https://github.com/FuelLabs/sway/pull/7143#issuecomment-2864762955)

> Hey @JoE11-y thanks for the PR. Just letting you know I plan to look at this properly on Monday.

### @JoE11-y — 0 reactions  
`—`  ·  [link](https://github.com/FuelLabs/sway/pull/7143#issuecomment-2848577710)

> @IGI-111 this is ready for review.
> 
> I also noticed something, i was unable to trigger the lockfile update by just updating the members_manifest, it only worked when the forc.toml was already updated with new dependencies.

### @IGI-111 — 0 reactions  
`—`  ·  [link](https://github.com/FuelLabs/sway/pull/7143#issuecomment-2850471879)

> This looks nice but you need to add some tests and fix the CI errors before we can consider merging it.

### @JoE11-y — 0 reactions  
`—`  ·  [link](https://github.com/FuelLabs/sway/pull/7143#issuecomment-2850690918)

> Alright will do that.
> 
> On Mon, May 5, 2025, 10:47 AM IGI-111 ***@***.***> wrote:
> 
> > *IGI-111* left a comment (FuelLabs/sway#7143)
> > <https://github.com/FuelLabs/sway/pull/7143#issuecomment-2850471879>
> >
> > This looks nice but you need to add some tests and fix the CI errors
> > before we can consider merging it.
> >
> > —
> > Reply to this email directly, view it on GitHub
> > <https://github.com/FuelLabs/sway/pull/7143#issuecomment-2850471879>, or
> > unsubscribe
> > <https://github.com/notifications/unsubscribe-auth/ANGCG5W7LKLXHHZEX2C7FW3244XRTAVCNFSM6AAAAAB4LUHOYKVHI2DSMVQWIX3LMV43OSLTON2WKQ3PNVWWK3TUHMZDQNJQGQ3TCOBXHE>
> > .
> > You are receiving this because you authored the thread.Message ID:
> > ***@***.***>
> >

### @JoE11-y — 0 reactions  
`—`  ·  [link](https://github.com/FuelLabs/sway/pull/7143#issuecomment-2868497742)

> Alright will get right to refactoring the pr 🚀.
> 
> Thanks guys


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
