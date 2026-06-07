# keras-team/keras #21903 — Orbax Loading and Sharding Support feature

**[View PR on GitHub](https://github.com/keras-team/keras/pull/21903)**

| | |
|---|---|
| **Author** | @amitsrivastava78 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @hertschuh
> Can you tighten the `orbax_checkpoint_test.py` file. It's extremely long and hard to follow. I think: a lot fewer tests could cover basically the same [and] some parameterized tests could minimize code duplication

### @hertschuh
> For the multi-device test, we have to do something like this... AND the test needs to be run by pytest separately in the workflows (which we're not doing right now, that's a bug).

### @gemini-code-assist
> My feedback focuses on improving code maintainability by reducing duplication and enhancing error handling in the new test cases.

### @codecov-commenter
> Patch coverage is `70.00000%` with `21 lines` in your changes missing coverage. Please review.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
