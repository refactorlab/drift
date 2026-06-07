# rust-lang/rfcs #3923 — Cargo RFC for min publish age

**[View PR on GitHub](https://github.com/rust-lang/rfcs/pull/3923)**

| | |
|---|---|
| **Author** | @tmccombs |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Noratrieb
> But this would mean that when regenerating the lockfile (when `update --precise` was used instead of Cargo.toml), this security update would be **lost** silently, which sounds suboptimal.

### @clarfonthey
> What would constitute a valid empirical basis is vulnerabilities that _have_ been caught by this system after it's been implemented in other places...The only argument listed is that the time between publication and mitigation is short.

### @woodruffw
> The core thesis is that the relevant parties here are security scanners, not early victims...the overwhelming majority of malicious package reports comes from automated static analysis, not from users.

### @fintelia
> With perfect visibility into the speed of version rollouts, crate authors might account for the difference. But I fear that 'someone's CI detected the breakage 2 hours after release' is harder to justify yanking than '5 days but most use 7+ day cooldown.'

### @Mark-Simulacrum
> In that case just commenting out or setting the time to zero feels better to me than complicating the configuration out of the gate with two options.

### @epage
> This isn't meant to be an exhaustive solution but one part of improving the whole and one we can deploy rather cheaply/quick for improvement while continuing larger improvements.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
