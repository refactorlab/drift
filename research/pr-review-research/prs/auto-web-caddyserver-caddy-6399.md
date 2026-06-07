# caddyserver/caddy #6399 — core: add modular `network_proxy` support

**[View PR on GitHub](https://github.com/caddyserver/caddy/pull/6399)**

| | |
|---|---|
| **Author** | @mohammed90 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mholt
> Sometimes linters/vet will catch this, but if not, I guess we can keep it as-is. I had planned at one point to tune our Caddy docs to account for the Godoc convention and help eliminate the repetition, but I haven't gotten around to it yet.

### @mohammed90
> It's a Go idiom. However, we pick up the same doc lines for our documentation, so I had to make a judgement call to either make it sensible for our documentation or meet the informal convention of Go docs. It's less confusing for our users to see the module name instead of the other way around.

### @CzBiX
> This chages seems to have broken the existing `forward_proxy_url` usage with panic: reflect: call of reflect.Value.Type on zero Value

### @mohammed90
> Fixed in [737936c](https://github.com/caddyserver/caddy/commit/737936c06be001a40c2d743d17d1e3df148408f0)

### @francislavoie
> Design makes sense to me 👍

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
