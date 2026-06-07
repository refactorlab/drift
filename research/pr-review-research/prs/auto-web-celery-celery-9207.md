# celery/celery #9207 — Native Delayed Delivery in RabbitMQ

**[View PR on GitHub](https://github.com/celery/celery/pull/9207)**

| | |
|---|---|
| **Author** | @thedrow |
| **Status** | Merged (November 17, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Nusnus
> I have done a deep dive into the PR and found some issues. I found at least 1 bug, some missing doc, cosmetic issues and some questions to make sure I fully understand the code, and some more minor stuff.

### @Nusnus
> Please take note the new Kombu RC release, which is a requirement for this PR, has introduced a new breaking bug as described in celery/kombu#2157. Obviously, we do not want to revert any changes, but if we merge this PR without fixing Kombu (first IMHO), then we'll introduce a dependency in Celery v5.5 to a confirmed broken (RC) version of Kombu.

### @Nusnus
> Merge/Rebase on `main` to make sure you're up to date. Ping me when you're done.

### @Jean-Daniel
> Out of curiosity, what are the benefit of the NServiceBus implementation versus using per-message TTL by specifying the `expiration` field when sending a delayed message?

### @Nusnus
> Well done @thedrow 👏 Thank you for attending to all of the review issues during the work on this new core mechanism in Celery. The community is going to appreciate it a lot.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
