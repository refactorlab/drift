# hashicorp/consul #22790 — feat(ui): `yarn` -> `pnpm`

**[View PR on GitHub](https://github.com/hashicorp/consul/pull/22790)**

| | |
|---|---|
| **Author** | @aklkv |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @aklkv
> you do not really need `run` it's optional

### @suresh-hashicorp
> I'll keep `run` for a little clarity. I would probably get confused if i don't see run.

### @aklkv
> ops, we need to remove this script, it was a part of migration step, no longer needed

### @aklkv
> you still need node setup and pnpm

### @aklkv
> if everyone is using nvm this is ok but it might be better to use package.json

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
