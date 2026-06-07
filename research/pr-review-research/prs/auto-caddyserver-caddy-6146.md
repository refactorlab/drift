# caddyserver/caddy #6146 — autohttps: Implement `auto_https prefer_wildcard` option

**[View PR on GitHub](https://github.com/caddyserver/caddy/pull/6146)**

| | |
|---|---|
| **Author** | @francislavoie |
| **Status** | ✅ merged |
| **Opened** | 2024-03-04 |
| **Repo importance** | ★73,173 · 4,761 forks · score 97,210 |
| **Diff** | +449 / −20 across 7 files |
| **Engagement** | 48 conversation · 4 inline review comments |

## Top review comments (ranked by reactions)

### @mholt — 6 reactions  
`🎉 5 · 🚀 1`  ·  [link](https://github.com/caddyserver/caddy/pull/6146#issuecomment-2388656459)

> This will go out with 2.9 beta 1. Would appreciate some field testing!

### @omltcat — 5 reactions  
`👍 5`  ·  [link](https://github.com/caddyserver/caddy/pull/6146#issuecomment-2093539281)

> Glad there is a PR for this and I really look forward to it. Thank you for your great work. One big advantage of having separate site blocks is when using `caddy-docker-proxy` labels.
> 
> Since these labels can be distributed across multiple docker-compose files, there can be some possibilities of misconfiguration somewhere (especially done by multiple people). With the current [handle](https://caddyserver.com/docs/caddyfile/patterns#wildcard-certificates) approach, if one of the subdomain is misconfigured, causes the ENTIRE wildcard site block to be removed, bringing down everything. With this PR, the failure would at least be localized (hopefully😊)

### @mholt — 4 reactions  
`👍 3 · ❤️ 1`  ·  [link](https://github.com/caddyserver/caddy/pull/6146#issuecomment-2378094422)

> I am now wondering if we should make preferring wildcards the default behavior as @abjugard suggested above.
> 
> In Slack, it was expressed that it would be a breaking change, but I am not sure if there are (m)any(?) use cases that would actually break. A wildcard cert is just as good as a subdomain cert.

### @polarathene — 3 reactions  
`👍 2 · 🚀 1`  ·  [link](https://github.com/caddyserver/caddy/pull/6146#issuecomment-2308585389)

> > If you want to opt-out for just one domain that's covered by a wildcard, then _don't use this feature_ and do it the `handle` way 🤷‍♂️
> 
> Could there not just be a `tls` or similar directive for a more explicit opt-out? (_I don't need such functionality myself though_)
> 
> It already seems to be an issue according to [this report](https://github.com/caddyserver/caddy/issues/5933#issuecomment-1817915767) where an internal wildcard cert is being used instead of the LetsEncrypt one for an explicit site address.
> 
> Alternatively, you could go the other way around like with `local_certs` / `tls internal`, and instead have something like `tls internal_wildcard` or `prefer_wildcard` in the actual `tls` directive options? (_assuming that could also be used to prefer FQDN as an override too_).
> 
> ---
> 
> Since the [certmagic subject transformer feature](https://github.com/caddyserver/certmagic/issues/280) is available and Caddy 2.8 is released, is there anything that can be done to assist moving this feature forward?
> 
> > I've only manually (visually) tested with a few simple usecases. Unfortunately we have a big lack of tests for the Automatic HTTPS logic because it manipulates config at runtime.
> > I probably need help with testing this to make sure it doesn't have weird side effects.
> 
> If you can provide a rough outline of what to test, I could put together configs to verify?
> 
> ---
> 
> ~~One [potential bug (_without this PR_) that already appears to exist](https://github.com/caddyserver/caddy/issues/5216#issuecomment-2335098735) is assigning a domain a wildcard cert from external files, and anoth … *[truncated]*

### @francislavoie — 2 reactions  
`👍 2`  ·  [link](https://github.com/caddyserver/caddy/pull/6146#issuecomment-2379816972)

> I _really_ don't agree with any of this @mholt. As I said in Slack, I've seen many users (people asking for help in the forums) that try to load a wildcard cert into Caddy e.g. a Cloudflare Origin cert, which _should not_ apply to all their subdomains because they might have some subdomains which _are not_ proxied by Cloudflare (e.g. resolve to their private IP address for their LAN, non-public subdomain).
> 
> If we change the default behaviour right now, it could break existing configs that do this sort of thing. I don't feel comfortable with that at all, especially when the implementation in this PR is not vetted enough to act as a default.
> 
> I much rather take the current implementation (which is opt-in, not opt-out), have users try it and find the edgecases over time, _and then_ consider making it the default later on.
> 
> We've been sitting on this too long, I don't want to bikeshed making it on-by-default which is a different scale of consideration than having it opt-in, I want to get this out there so people can use it ASAP, as an experimental feature.

### @mholt — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/caddyserver/caddy/pull/6146#issuecomment-2384082192)

> Ok, I hear you. If we merge this, I would like for it to be an experimental / transitional feature, as we prepare to make using existing wildcards the norm/default behavior. This might be the kind of thing best learned from field experience, so I don't want to lock us into one choice either way.
> 
> So, how about this for a plan:
> 
> - We can merge this in, and document it as experimental/temporary, and that it may soon be the default behavior.
> - If that goes well overall, it becomes the default behavior and we remove this option.
> - When it becomes the default behavior, we add a new option to get unique certificates for every explicitly-configured subdomain, even if they are covered by wildcards. Or maybe the list of domains is explicitly specified in config. Either way, there will be an "escape hatch" for the new default behavior for the case(s) that is needed.
> 
> Sound good?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
