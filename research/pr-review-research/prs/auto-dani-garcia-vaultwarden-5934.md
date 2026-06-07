# dani-garcia/vaultwarden #5934 — Update webauthn-rs to 0.5.x

**[View PR on GitHub](https://github.com/dani-garcia/vaultwarden/pull/5934)**

| | |
|---|---|
| **Author** | @zUnixorn |
| **Status** | ✅ merged |
| **Opened** | 2025-06-06 |
| **Repo importance** | ★61,897 · 2,883 forks · score 78,170 |
| **Diff** | +346 / −105 across 7 files |
| **Engagement** | 41 conversation · 15 inline review comments |

## Top review comments (ranked by reactions)

### @dani-garcia — 5 reactions  
`👍 5`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/5934#issuecomment-3155284794)

> I think we can leave it for now, and we'll do a separate PR removing all FIDO2 backwards compatibility code at a later time.

### @tessus — 3 reactions  
`👀 3`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/5934#issuecomment-3054116574)

> @dani-garcia I think this one needs one last workflow approval. With 0.5.2 building for arm64, armv7 and armv6 has been solved. The requested changes have also been implemented.

### @stefan0xC — 2 reactions  
`👍 2`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/5934#issuecomment-3172239930)

> > I wonder if a domain is truly needed or if only this check is blocking : https://docs.rs/webauthn-rs/latest/src/webauthn_rs/lib.rs.html#293 Might try to test with a custom build.
> 
> I think it is according to https://www.w3.org/TR/webauthn-2/#relying-party-identifier - so that's why I've decided to hide it if we don't support it, cf. #6160

### @tessus — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/5934#issuecomment-3020604911)

> @dani-garcia @BlackDex can you start the workflows?

### @tessus — 1 reactions  
`👍 1`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/5934#issuecomment-3021121661)

> Yep, should work. I'll see in a few minutes. If not, I'll just open a PR in your repo.

### @tessus — 1 reactions  
`👀 1`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/5934#issuecomment-3021152940)

> Yep, worked. But I had to rebase to solve the conflict. Now we need @dani-garcia or @BlackDex to restart the workflows again.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
