# rust-lang/rfcs #3923 — Cargo RFC for min publish age

**[View PR on GitHub](https://github.com/rust-lang/rfcs/pull/3923)**

| | |
|---|---|
| **Author** | @tmccombs |
| **Status** | ✅ merged |
| **Opened** | 2026-02-23 |
| **Repo** | curated review-culture seed |
| **Diff** | +541 / −0 across 1 files |
| **Engagement** | 19 conversation · 141 inline review comments |

## Top review comments (ranked by reactions)

### @epage — 10 reactions  
`👍 10`  ·  [link](https://github.com/rust-lang/rfcs/pull/3923#issuecomment-3945889495)

> @Shnatsel 
> 
> > The way forward is to stop whining and start using `cargo vet` instead of trying to pile on ever-increasing amounts of questionable heuristics.
> 
> Please note that this is not a constructive way to engage with others on this topic.

### @swarnimarun — 10 reactions  
`❤️ 6 · 🚀 4`  ·  [link](https://github.com/rust-lang/rfcs/pull/3923#issuecomment-4160690878)

> Can we get a minimum version of this through the RFC process? Given the recent rise in supply chain attacks and given all/most used package managers across other major language ecosystems already support this, with Cargo being the only major outlier, putting a significant target on Rust ecosystem.
> 
> For exceptional cases maybe we should just allow users to pin versions and cargo can ask the user if they are sure they want to use a "recent" version that may have security concerns, and if they select yes we update lock file and not worry about it.
> 
> Just my 2 cents; don't want to create noise, or pressure though.
> 
> Just having the ability to set `min-publish-age: 30 days` will give me quite a bit of piece of mind.
> 
> Also just to make it clear, I do also like that the time unit is included in the string, currently npm, bun, and pnpm all 3 have different time units which is kind of insane. 
> 
> uv does it right, imho. 
> ```
> ~/.config/uv/uv.toml
> exclude-newer = "7 days"
> ```
> 
> ignore the name of the variable.
> 
> Again feel free to ask me any questions about any doubts, or consistency stuff, but otherwise I don't think I can add much here. 
> 
> Thanks a bunch for all the awesome work folks.

### @djc — 5 reactions  
`👍 5`  ·  [link](https://github.com/rust-lang/rfcs/pull/3923#issuecomment-3945710577)

> FWIW, I found the [linked blog post](https://blog.yossarian.net/2025/11/21/We-should-all-be-using-dependency-cooldowns) to be fairly convincing that something in this direction makes sense. There is a very wide gap between (a) issuing `cargo update` sight unseen and (z) making sure all your dependencies are trusted by cargo-vet, and this seems like a decent middle ground.

### @jlizen — 5 reactions  
`👍 5`  ·  [link](https://github.com/rust-lang/rfcs/pull/3923#issuecomment-4390038954)

> One open question that isn't critical for initial implementation is, how to address the use case of:
> "I want to bypass my min publish age to build this new version of a crate that has a CVE fix, but I don't want to open the doors to the rest of the registry bypassing min age"
> 
> In other words, a shallow bypass, that lets you pull just one thing, if it has no also-new forced dependencies. Or if it does, you can add them one by one without opening the floodgates.

### @dertin — 5 reactions  
`👍 2 · ❤️ 3`  ·  [link](https://github.com/rust-lang/rfcs/pull/3923#issuecomment-4467177739)

> Hi all!
> 
> I just released v0.3.1 https://github.com/dertin/cargo-cooldown/releases/tag/v0.3.1 with the config shape intentionally aligned with this RFC: `[registry].global-min-publish-age`, `[registry].min-publish-age`, `[registries.<name>].min-publish-age`, plus the corresponding env vars.
> 
> In cargo-cooldown this currently lives in a separate `cooldown.toml` file, not in Cargo’s `.cargo/config.toml`, so it does not collide with Cargo’s own configuration today. The goal was to mirror the RFC vocabulary for easier migration and comparison, while keeping cargo-cooldown-specific behavior clearly namespaced under `[cooldown]`.
> 
> I’m not suggesting this should block FCP or expand the initial RFC scope. Also, a wrapper is not a substitute for resolver-level Cargo support. I mainly wanted to share cargo-cooldown as implementation/prior-art feedback while this moves toward Cargo implementation and stabilization.
> 
> A few things it now experiments with that may be useful later:
> - exact version allow rules for targeted urgent fixes, e.g. `[[allow.exact]] crate + version`;
> - per-package shorter `min-publish-age`, including `0`, as a more explicit alternative to a broad global bypass;
> - fallback behavior with prompt-based acceptance when Cargo can only produce a graph containing some fresh versions;
> - registry-specific policy, source replacement / mirror handling, and targeted warnings when fresh versions remain.
> 
> If there are specific policy or UX questions that would be useful to prototype before Cargo implementation, feel free to open an issue or leave a comment in cargo-cooldown. I’d b … *[truncated]*

### @dertin — 4 reactions  
`👍 4`  ·  [link](https://github.com/rust-lang/rfcs/pull/3923#issuecomment-4323195603)

> I wanted to share one data point from experimenting with the ideas discussed here: 
> I just published [cargo-cooldown 0.3.0](https://crates.io/crates/cargo-cooldown).
> 
> This release was mostly focused on making minimum publish-age policies practical for larger graphs and more aggressive windows, for example 60 days or more. It now uses Cargo's local registry index `pubtime` metadata first (rust-lang/cargo#16270), reuses release timelines and inspections during a run, and validates `Cargo.lock` changes in batches instead of relying only on one-package-at-a-time updates.
> 
> One thing that became very clear while building this, and that seems related to the discussion around `cargo update --precise` being shallow, is that native support for pinning multiple packages together would help a lot. `cargo-cooldown` currently works around this by grouping small sets of crates connected by exact-version requirements, searching for a compatible older assignment from local index metadata, rewriting those `Cargo.lock` entries together, and then asking Cargo to validate the result with `cargo metadata --locked`.
> 
> That works, but it is still a bounded workaround. Having this operation available directly in Cargo would make this kind of policy simpler and more reliable.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
