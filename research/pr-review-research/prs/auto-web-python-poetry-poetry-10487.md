# python-poetry/poetry #10487 — feature: poetry show json output format

**[View PR on GitHub](https://github.com/python-poetry/poetry/pull/10487)**

| | |
|---|---|
| **Author** | @Aearsears |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @radoering
> Thanks for your contribution. It looks quite good to me. Just some minor remarks.

### @colindean
> I add one little nit, a personal preference for Enums over lists of strings for enumerations of valid options.

### @Aearsears
> for the `json` package is it fine to import it on the module scope? will this affect poetry's performance?

### @radoering
> It should be fine. Unfortunately, there is no documentation about which imports are expensive and should not be done at top level.

### @colindean
> @Aearsears thank you so very much for picking this up and running with it. This is great work and I can't wait to put it into use.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
