# mrdoob/three.js #27586 — WebXRManager: Added depth sensing support (v2).

**[View PR on GitHub](https://github.com/mrdoob/three.js/pull/27586)**

| | |
|---|---|
| **Author** | @cabanier |
| **Status** | ✅ merged |
| **Opened** | 2024-01-18 |
| **Repo importance** | ★112,854 · 36,386 forks · score 263,396 |
| **Diff** | +159 / −4 across 6 files |
| **Engagement** | 41 conversation · 10 inline review comments |

## Top review comments (ranked by reactions)

### @cabanier — 4 reactions  
`👍 4`  ·  [link](https://github.com/mrdoob/three.js/pull/27586#issuecomment-1916188810)

> > By the way, I feel like the depthTexture is one frame behind (or more). Are we not fetching it at the right time or is this something that can be improved on the browser side?
> 
> It should be timewarped to the same time that we use for controller poses and other openxr calls. It's possible though that I'm returning the previous one; I will check.

### @cabanier — 4 reactions  
`👍 4`  ·  [link](https://github.com/mrdoob/three.js/pull/27586#issuecomment-1924216289)

> This is a bug on the browser side. I will fix it. No changes in three are needed.

### @cabanier — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/mrdoob/three.js/pull/27586#issuecomment-1899027966)

> > Cool! What's your perception of it?
> 
> See https://twitter.com/rcabanier/status/1748050448270135425

### @cabanier — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/mrdoob/three.js/pull/27586#issuecomment-1928667488)

> I found and fixed the problem in the browser. It will be part of the next browser release.

### @cabanier — 2 reactions  
`👍 2`  ·  [link](https://github.com/mrdoob/three.js/pull/27586#issuecomment-1899236171)

> > > For some reason I get a 90° around Y rotated camera here in our scenes, and frustum culling is wrong. Does this maybe not work when the camera is parented to something or the camera is moving after the session is started?
> > 
> > Yeah, maybe that all needs to move to the webxr manager. I'll take a look
> 
> @hybridherbst I updated the PR. It's even simpler now

### @hybridherbst — 2 reactions  
`👍 2`  ·  [link](https://github.com/mrdoob/three.js/pull/27586#issuecomment-1899317734)

> Thank you, that works for me now too! Great to be able to compare the two approaches – and a hard decision on what's better suited for three.js 🗡️ 
> 
> - v1: less pixelated, lots of potential for artistic exploration of the provided scene depth, technically quite involved
> - v2: more pixelated, better performance, not much to adjust, technically very simple
> 
> Here's a quick test with custom shaders on v1: https://twitter.com/hybridherbst/status/1748106798173733036
> 
> Maybe one possible approach could be:
> - v2 is shipped in three.js core and covers the most typical use case
> - v1 is provided as an example, using shader patching?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
