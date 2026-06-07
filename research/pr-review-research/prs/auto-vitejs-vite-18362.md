# vitejs/vite #18362 — feat: use a single transport for fetchModule and HMR support

**[View PR on GitHub](https://github.com/vitejs/vite/pull/18362)**

| | |
|---|---|
| **Author** | @sapphi-red |
| **Status** | ✅ merged |
| **Opened** | 2024-10-16 |
| **Repo** | curated review-culture seed |
| **Diff** | +1155 / −746 across 31 files |
| **Engagement** | 21 conversation · 57 inline review comments |

## Top review comments (ranked by reactions)

### @hi-ogawa — 2 reactions  
`❤️ 1 · 👀 1`  ·  [link](https://github.com/vitejs/vite/pull/18362#issuecomment-2440391232)

> I made a POC of builtin fetch transport in https://github.com/vitejs/vite/pull/18485. Not sure if this exact implementation is usable, but I thought having a different transport implementation would help validating the transport API design here at least. Any feedback there is welcome!

### @sheremet-va — 1 reactions  
`👍 1`  ·  [link](https://github.com/vitejs/vite/pull/18362#issuecomment-2419196707)

> @bluwy pointed out the inconsistency in the naming of `RunnerTransport` in https://github.com/vitejs/vite/discussions/16358#discussioncomment-10960752
> 
> Should we also standardise it here?

### @sheremet-va — 1 reactions  
`😄 1`  ·  [link](https://github.com/vitejs/vite/pull/18362#issuecomment-2432117491)

> I feel sad that we can't do `transport: { fetchModule() { /* anything */ } }` anymore, but it makes everything else so much easier, so I think it's worth it 😄

### @hi-ogawa — 1 reactions  
`👍 1`  ·  [link](https://github.com/vitejs/vite/pull/18362#issuecomment-2451401054)

> > * expose `handleInvoke` from `NormalizedHotChannel`
> 
> This sounds good to me :+1: It looks like we cannot hide the normalization entirely anyways, so adding this won't hurt hopefully.
> (But again, I'm fine to iterate further in a separate PR.)

### @sapphi-red — 1 reactions  
`👍 1`  ·  [link](https://github.com/vitejs/vite/pull/18362#issuecomment-2456094472)

> I implemented `NormalizedHotChannel::handleInvoke` 👍

### @sapphi-red — 0 reactions  
`—`  ·  [link](https://github.com/vitejs/vite/pull/18362#issuecomment-2418821624)

> I polished the interface so that it's more easier to implement for the env providers. I think we need a better name and check if this is not breaking a code that was working in 5.x.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
