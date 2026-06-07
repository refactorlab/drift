# python-poetry/poetry #9748 — Try finding commit using short SHA if it is not on HEAD

**[View PR on GitHub](https://github.com/python-poetry/poetry/pull/9748)**

| | |
|---|---|
| **Author** | @mikhainin |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jelmer
> I'd appreciate if you could take a look if it makes sense (from a dulwich point of view).

### @radoering
> We have tests in tests/integration/test_utils_vcs_git.py and in main/tests/vcs/git/test_backend.py. Fast tests that do not require an external repository can be put into the latter.

### @jelmer
> Creating a local repository in e.g. a tempdir should be fast and easy with Dulwich - Repo.init(path) will do what you need.

### @abn
> This will likely also require #9849 if we intend to update dulwich.

### @dimbleby
> Since recent dulwich releases are bumping only the patch number, poetry users are already getting the latest dulwich.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
