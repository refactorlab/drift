# nodejs/node #54630 — assert: add partialDeepStrictEqual

**[View PR on GitHub](https://github.com/nodejs/node/pull/54630)**

| | |
|---|---|
| **Author** | @puskin |
| **Status** | ✅ merged |
| **Opened** | 2024-08-29 |
| **Repo** | curated review-culture seed |
| **Diff** | +803 / −2 across 4 files |
| **Engagement** | 74 conversation · 94 inline review comments |

## Top review comments (ranked by reactions)

### @puskin — 6 reactions  
`👍 5 · ❤️ 1`  ·  [link](https://github.com/nodejs/node/pull/54630#issuecomment-2408969910)

> Small poll about the name of the `partialDeepStrictEqual` method, which allows to perform subset comparisons as:
> 
> `assert.partialDeepStrictEqual({ a: 1, b: 2, c: 3 }, { a: 1, b: 2 });`
> 
> 👍   partialDeepStrictEqual  
> 😄   subsetDeepStrictEqual  
> 🎉   matchStrictObject  
> ❤️   deepStrictMatch  
> 🚀   ??? (please write the new proposed name)
> 
> You can use the emojis above to react on this comment to vote your favorite!

### @aduh95 — 4 reactions  
`👍 4`  ·  [link](https://github.com/nodejs/node/pull/54630#issuecomment-2412480845)

> If you don't want `strict` in the name, you can import it from `node:assert/strict`. Removing it from the exported name in `node:assert` would be confusing IMO.

### @pmarchini — 4 reactions  
`👍 4`  ·  [link](https://github.com/nodejs/node/pull/54630#issuecomment-2458236447)

> > Small poll about the name of the `partialDeepStrictEqual` method, which allows to perform subset comparisons as:
> > 
> > `assert.partialDeepStrictEqual({ a: 1, b: 2, c: 3 }, { a: 1, b: 2 });`
> > 
> > 👍 partialDeepStrictEqual 😄 subsetDeepStrictEqual 🎉 matchStrictObject ❤️ deepStrictMatch 🚀 ??? (please write the new proposed name)
> > 
> > You can use the emojis above to react on this comment to vote your favorite!
> 
> I've seen this PR open for quite a while. Before this PR, I noticed a very similar discussion in another PR, from which this one originated (https://github.com/nodejs/node/pull/53415).
> 
> I think that this feature would add significant value to the assertions set, so I strongly believe we should unblock this by deciding on a name.  
> Considering that this discussion has already been going on for quite some time, I think it’s time to ask for a TSC vote.
> 
> @nodejs/tsc

### @BridgeAR — 4 reactions  
`👍 1 · ❤️ 2 · 🚀 1`  ·  [link](https://github.com/nodejs/node/pull/54630#issuecomment-2495602313)

> @puskin94 thank you for sticking to this and to continuesly improve everything so that it was able to land!
> Great contribution!

### @simoneb — 3 reactions  
`👍 3`  ·  [link](https://github.com/nodejs/node/pull/54630#issuecomment-2358197506)

> > Note that the method names will also need to be added to `lib/internal/test_runner/test.js`:
> > 
> > https://github.com/nodejs/node/blob/e49cf7acfbfb5ce36f49911d22f533c7056137c2/lib/internal/test_runner/test.js#L103-L120
> > 
> > An equivalent change will be required in `test/parallel/test-runner-assert.js`:
> > 
> > https://github.com/nodejs/node/blob/e49cf7acfbfb5ce36f49911d22f533c7056137c2/test/parallel/test-runner-assert.js#L7-L25
> 
> Maybe we should add an automatic way to check that this happens?

### @puskin — 3 reactions  
`👍 3`  ·  [link](https://github.com/nodejs/node/pull/54630#issuecomment-2411224251)

> > Using `strict` in the name is IMO not needed. The original usage was already not ideal and it is still confusing people. I think just dropping that overall would be best.
> 
> I agree with you, I would remove it too, but wouldn't it be more confusing to remove the `strict` part here and keeping it in the other methods? If you do that, I would assume this is loose


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
