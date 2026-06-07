# espressif/esp-idf #17799 — feat(esp_http_server): Make HTTP(S)_SERVER_EVENT events optional (IDFGH-16707)

**[View PR on GitHub](https://github.com/espressif/esp-idf/pull/17799)**

| | |
|---|---|
| **Author** | @jimmyw |
| **Status** | Merged (December 13, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mahavirj
> Could we use similar approach (stub out the implementation) in HTTP server component as well?

### @mahavirj
(Suggested using a Doxygen-safe guard rather than a bare `#ifdef`)
> #if CONFIG_HTTPD_ENABLE_EVENTS || __DOXYGEN__

### @mahavirj
(Requested explicit comment labels on closing conditional directives)
> #endif // CONFIG_HTTPD_ENABLE_EVENTS

### @mahavirj
(Applied the same Doxygen-safe guard pattern for the HTTPS server events)
> #if CONFIG_ESP_HTTPS_SERVER_EVENTS || __DOXYGEN__

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
