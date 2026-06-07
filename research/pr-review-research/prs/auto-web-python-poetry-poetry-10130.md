# python-poetry/poetry #10130 — feat(cli): Support PEP 735 (Dependency Groups)

**[View PR on GitHub](https://github.com/python-poetry/poetry/pull/10130)**

| | |
|---|---|
| **Author** | @finswimmer |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @radoering
> The `support pep 735` commit is missing a test for `remove` and the tests in `test_remove_plugins` are still `xfail`.

### @radoering
> I think we should add a test for `poetry remove` similar to `test_remove_from_project_and_poetry` for dependencies with additional information in the `tool.poetry` section.

### @radoering
> To satisfy the export tests, you can try to add `poetry remove --lock poetry-core` in [the workflow file].

### @sourcery-ai
> The add/remove command handlers are now very lengthy with repeated PEP 735 branching—extract the core dependency-group logic into dedicated helper methods or classes.

### @sourcery-ai
> Extract the repeated pep_735 parameterization and assertion blocks in tests into shared fixtures or helper functions to reduce boilerplate.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
