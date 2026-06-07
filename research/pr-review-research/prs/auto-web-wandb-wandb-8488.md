# wandb/wandb #8488 — chore: update min version of sentry-sdk

**[View PR on GitHub](https://github.com/wandb/wandb/pull/8488)**

| | |
|---|---|
| **Author** | @jacobromero |
| **Status** | Merged (Oct 9, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dmitryduev
> the main scenario we need to test is the following: set up a script that imports sentry and points it at a sentry dsn; set up out dsn to point at say sdk-client...the reason why we've been using their private api's was bc the default set up steps were resulting in us picking up third-party events

### @dmitryduev
> Thanks a lot [@jacobromero](https://github.com/jacobromero), LGTM (modulo a couple nits)!

### @kptkin
> LGTM!!!

---
*Note: This PR's discussion focused primarily on Sentry scope/data-leakage testing scenarios; most reviewer feedback was on resolved inline code comments rather than broad design threads.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
