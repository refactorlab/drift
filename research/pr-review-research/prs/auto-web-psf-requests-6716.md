# psf/requests #6716 — Allow for overriding of specific pool key params

**[View PR on GitHub](https://github.com/psf/requests/pull/6716)**

| | |
|---|---|
| **Author** | @sigmavirus24 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @nateprewitt
> If @florianlink, @luisvicenteatprima and/or @Marco-Kaulea are willing to give this patch a try, it would be nice to make sure we're not missing any other requirements. Otherwise this seems straight forward to me, just a couple minor comments to add a date and the current PR reference.

### @pquentin
> While this provides a new API to change the kwargs, the previous API (currently used by the Python Elasticsearch client) no longer works...It fails correctly with requests 2.31.0, but unexpectedly works with requests 2.32.2 and with the changes in this pull request.

### @nateprewitt
> To provide that quick update, we're currently looking at disabling the SSLContext optimization in the event we have a PoolManager with any custom configuration kwargs. That should leave the default Requests implementation better off without requiring lifting from users with custom `init_poolmanager` implementations in their adapters.

### @pquentin
> That does mean a lot of adapter users will silently break in 2.32, especially if the examples in docs don't change.

### @achapkowski
> @sigmavirus24 this doesn't fix the recursion issue we see in issue #6715

### @nateprewitt
> @achapkowski I believe we already root caused the recursion issue for you some time ago in Esri/arcgis-python-api#1698 and provided guidance on what you need to fix in arcgis.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
