# gin-gonic/gin #4227 — chore(bind): return 413 status code when error is `http.MaxBytesError`

**[View PR on GitHub](https://github.com/gin-gonic/gin/pull/4227)**

| | |
|---|---|
| **Author** | @ItalyPaleAle |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ItalyPaleAle
> The Go standard library includes a method http.MaxBytesReader that allows limiting the request body...This PR makes sure that when the error is of kind `http.MaxBytesError`, Gin returns the correct status code 413 (Request Entity Too Large) instead of a generic 400 (Bad Request).

### @ItalyPaleAle
> I cannot repro locally. Looks like tests pass on other platforms, but fail when the `sonic` tag is used. Maybe this is caused by an incompatibility with the sonic library?

### @ItalyPaleAle
> This feature won't work when using go-json or sonic due to bugs upstream...In those cases, gin will continue to return a 400 response.

### @appleboy
> Please rebase the master branch

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
