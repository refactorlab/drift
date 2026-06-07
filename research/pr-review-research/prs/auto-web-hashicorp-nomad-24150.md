# hashicorp/nomad #24150 — start: allow users to call job start command to start stopped jobs

**[View PR on GitHub](https://github.com/hashicorp/nomad/pull/24150)**

| | |
|---|---|
| **Author** | @martisah |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @tgross
> Don't forget to run `make cl` to add a changelog item. Given how tricky the reverse iteration and selection of versions is, it'd probably be a good idea to have a test that covers the more complex selection scenarios like having job that's stopped and started multiple times.

### @tgross
> It looks like GitHub was 'helpful' and hid some of the comments, be sure to expand them as you work thru the review.

### @aimeeu
> Concerned that the start.mdx refers to Consul and Vault `allow_unauthenticated` config parameter that no longer exists.

### @martisah
> batch job versions do not get set as running after a stop, rather they are set to pending

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
