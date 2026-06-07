# pypa/pip #13065 — Implement a `--group` option for installing from `[dependency-groups]` found in `pyproject.toml` files

**[View PR on GitHub](https://github.com/pypa/pip/pull/13065)**

| | |
|---|---|
| **Author** | @sirosen |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @pfmoore
> It did occur to me when this PR was submitted that we hadn't reached agreement on auto-discovering `pyproject.toml`, and I'm still a little uncomfortable about it.

### @zanieb
> I feel like we did not reach consensus that automatically discovering a `pyproject.toml` in the working directory was the right solution. I'll repeat that I think this is a surprising and significant change for pip.

### @pfmoore
> I would definitely like to know what the other @pypa/pip-committers think about this, though. There's also a wider discussion about how pip fits into the modern packaging ecosystem that I think the maintainers need to have.

### @notatallshaw
> Should pip have a concept of a project? And if so what should it assume the project structure looks like? If the answer to 1 for this PR is 'no', I'd like to point out that it doesn't stop pip adding a concept of a project in the future.

### @pfmoore
> I'm more than comfortable with a minor wart in how we name the option...if that's what it takes to get this implemented without a big redesign of pip.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
