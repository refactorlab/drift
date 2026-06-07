# nodejs/node #61871 — buffer: improve performance of multiple Buffer operations

**[View PR on GitHub](https://github.com/nodejs/node/pull/61871)**

| | |
|---|---|
| **Author** | @thisalihassan |
| **Status** | ✅ merged |
| **Opened** | 2026-02-17 |
| **Repo** | curated review-culture seed |
| **Diff** | +280 / −70 across 10 files |
| **Engagement** | 20 conversation · 118 inline review comments |

## Top review comments (ranked by reactions)

### @ChALkeR — 4 reactions  
`🚀 2 · 👀 2`  ·  [link](https://github.com/nodejs/node/pull/61871#issuecomment-3919176985)

> @thisalihassan toHex doesn't show a win anymore with `nbytes` update which should soon land (as it landed in `nbytes`)
> 
> Instead, it's ~3x slower.
> 
> See https://github.com/nodejs/nbytes/pull/12

### @thisalihassan — 1 reactions  
`🚀 1`  ·  [link](https://github.com/nodejs/node/pull/61871#issuecomment-3977925855)

> Hi @ChALkeR @anonrig @Renegade334 is this PR ready to land? can you also please check the latest benchmarks i have posted, I have compiled PDF for this benchmark in one my comments above for more detail
> 
> <img width="1352" height="832" alt="Screenshot 2026-03-01 at 2 29 23 AM" src="https://github.com/user-attachments/assets/ad036e29-99a9-4b51-a38a-e1cab2473c5e" />
> <img width="1501" height="772" alt="Screenshot 2026-03-01 at 2 29 40 AM" src="https://github.com/user-attachments/assets/f49f3501-cfb6-4ca1-8613-30bb614d1f1d" />
> <img width="1144" height="813" alt="Screenshot 2026-03-01 at 2 29 54 AM" src="https://github.com/user-attachments/assets/35c612a9-82fe-4546-8e9c-896497c0c943" />
> <img width="1208" height="812" alt="Screenshot 2026-03-01 at 2 28 57 AM" src="https://github.com/user-attachments/assets/99d39f7d-a1e4-43c8-8c2f-7832266d3e9f" />

### @aduh95 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/nodejs/node/pull/61871#issuecomment-3999140070)

> Benchmark CI: https://ci.nodejs.org/view/Node.js%20benchmark/job/benchmark-node-micro-benchmarks/1807/

### @aduh95 — 1 reactions  
`👍 1`  ·  [link](https://github.com/nodejs/node/pull/61871#issuecomment-4125915431)

> Can you rename the other `const len = this.length` / `const len = TypedArrayPrototypeGetLength(this)` to `bufferLength` please?

### @thisalihassan — 0 reactions  
`—`  ·  [link](https://github.com/nodejs/node/pull/61871#issuecomment-3919145191)

> Note on toBase64 / toBase64url:
> 
> I also tried replacing the C++ base64Slice/base64urlSlice bindings with V8's Uint8Array.prototype.toBase64() (similar to the toHex change) but it caused a 35-54% regression across all buffer sizes so I reverted base64/base64url and kept only the toHex optimization which showed a clear +26-37% win.

### @thisalihassan — 0 reactions  
`—`  ·  [link](https://github.com/nodejs/node/pull/61871#issuecomment-3919300052)

> Hi @ChALkeR thanks for flagging I was not aware. I benchmarked the nibble approach locally and it's indeed a much bigger win (~3x vs my ~30% with toHex). Reverted the toHex path entirely the other changes in this PR are unaffected.
> 
> Should I include the nbytes nibble HexEncode optimization in this PR or keep them as separate PRs?
> 
> ~~PS: One test is failing `/test/parallel/test-debugger-restart-message.js` I believe it's known mac issue and unrelated to my changes~~


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
