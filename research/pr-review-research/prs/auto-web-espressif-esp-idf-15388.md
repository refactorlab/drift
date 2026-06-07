# espressif/esp-idf #15388 — fix(esp_http_client): Fix host header for IPv6 address literal (IDFGH-14640)

**[View PR on GitHub](https://github.com/espressif/esp-idf/pull/15388)**

| | |
|---|---|
| **Author** | @thelazt |
| **Status** | Merged (February 26, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @safocl
> isn't _lwip_ part of the network stack for _esp32_? https://github.com/espressif/esp-idf/tree/master/components/lwip

### @safocl
> since this is a `static` function -- maybe it's worth checking somewhere higher in the API?

### @safocl
> in the code `bool is_ipv6 = (host != NULL && host[0] != '[' && strchr(host, ':')...` the code `host != NULL &&` should be taken out as a separate check

### @nileshkale123
> The changes look good to me, but I have a small code update request.

### @thelazt
> I would suggest a slightly different variant, which I think would slightly improve readability and prevent any future static analyzer from complaining

### @safocl
> Yes, that's okay. Thank you.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
