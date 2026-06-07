# openai/whisper #2487 — GitHub Actions: Add Python 3.13 to the testing

**[View PR on GitHub](https://github.com/openai/whisper/pull/2487)**

| | |
|---|---|
| **Author** | @cclauss |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @cclauss
> Python 3.13 was blocked waiting on `numba>=0.61.0` and `triton>3.1.0` but now the PyPI releases of both are compatible with Python 3.13.

### @rdinkel
> I am asking because the flatpak of kdenlive ships with python 3.13 and installing whisper inside fails building wheel.

### @cclauss
> When you think a pull request is useful and is ready to be merged, please consider giving it a positive review...Lots of 👍 and '_what is the ETA?_' comments are easier for maintainers to ignore than ✔️✔️✔️ from several different reviewers.

### @drcrallen
> Python 3.13 does not work for me with installation until I make this change...`locals()` docs describe the history of changes.

### @rdinkel
> Only users with explicit access to this repository may approve pull requests.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
