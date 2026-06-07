# ziglang/zig #20271 — ZON

**[View PR on GitHub](https://github.com/ziglang/zig/pull/20271)**

| | |
|---|---|
| **Author** | @MasonRemaley |
| **Status** | ✅ merged |
| **Opened** | 2024-06-12 |
| **Repo** | curated review-culture seed |
| **Diff** | +8790 / −434 across 146 files |
| **Engagement** | 41 conversation · 198 inline review comments |

## Top review comments (ranked by reactions)

### @MasonRemaley — 23 reactions  
`🚀 23`  ·  [link](https://github.com/ziglang/zig/pull/20271#issuecomment-2632612035)

> Yup! I'm excited to have this in for the release. :)

### @MasonRemaley — 16 reactions  
`👍 9 · ❤️ 7`  ·  [link](https://github.com/ziglang/zig/pull/20271#issuecomment-2350786437)

> @VisenDev it's not abandoned--this feature is very important to my work. I'm working on some other stuff w/ tight deadlines right now, but I'm planning on getting back to this in about a week and a half.

### @andrewrk — 16 reactions  
`👍 12 · ❤️ 4`  ·  [link](https://github.com/ziglang/zig/pull/20271#issuecomment-2613850113)

> Rest easy, my friend. If you look carefully you can see all the effort that went into doing exactly that today

### @mlugg — 16 reactions  
`🎉 9 · 😄 7`  ·  [link](https://github.com/ziglang/zig/pull/20271#issuecomment-2631511309)

> Merging without checks since aarch64-windows is behind.

### @MasonRemaley — 7 reactions  
`👍 1 · ❤️ 6`  ·  [link](https://github.com/ziglang/zig/pull/20271#issuecomment-2581956401)

> This is ready for review again! If there's anything I can do to make it easier let me know.
> 
> Major changes since the last review:
> 1. Both import ZON and the runtime parser were rewritten to use Zoir
> 2. Import ZON requires an explicit result type instead of trying to infer the type from the contents of the ZON file and then coerce it
>     * This is simpler, leads to better errors, and in all use cases I've come up with for import ZON you want an explicit result type anyway
> 4. The API was reorganized to avoid redundant names & follow Zig conventions
> 
> Note that @mlugg is planning on following up with a change to where in the compiler ZonGen is actually called.

### @MasonRemaley — 5 reactions  
`👍 1 · 🚀 4`  ·  [link](https://github.com/ziglang/zig/pull/20271#issuecomment-2240893826)

> I got to the point in my project where I wanna start using ZON, which gave me some good motivation to get through the remaining TODOs I had.
> 
> This is ready for review!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
