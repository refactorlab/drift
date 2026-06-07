# celery/celery #9371 — fix: prevent celery from hanging due to spawned greenlet errors in greenlet drainers

**[View PR on GitHub](https://github.com/celery/celery/pull/9371)**

| | |
|---|---|
| **Author** | @linusphan |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Nusnus
> Please add tests to make sure the changes are behaving as expected 🙏

### @auvipy
> can you also add some integration test for the change, please?

### @thedrow
> Unfortunately, our integration suite does not support gevent at this time. A smoke test will be more appropriate.

### @mothershipper
> The only behavior change should be for users that are already on a non-happy path, the happy path shouldn't have changed.

### @Nusnus
> Check out the pytest-celery docs for the smoke tests: https://pytest-celery.readthedocs.io

### @mothershipper
> I don't believe the codecov comment on this PR is accurate, I think it was cached based on earlier commits.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
