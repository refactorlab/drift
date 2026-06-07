# nats-io/nats-server #7242 — Add HTTP proxy support for WebSocket leaf node connections

**[View PR on GitHub](https://github.com/nats-io/nats-server/pull/7242)**

| | |
|---|---|
| **Author** | @danbailey1000 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @kozlovic
> We would need configuration file parsing, options validation and some sort of test. But more importantly, I have a concern about how this would work.

### @kozlovic
> Suppose that you configure the server to have a remote with a non TLS connection, but the proxy uses TLS to communicate with the HUB that requires TLS, then this would not work...

### @kozlovic
> I would recommend that you rebase and squash all your commits into 1 and you need to have a signoff

### @kozlovic
> The main issue is that we need to ensure that the check for the proxy response is not consuming data from the remote server, which we do right now which would cause some of the tests to fail.

### @neilalexander
> I think I would really rather us not build and parse HTTP requests/responses by hand here when the Go standard library has the ability to do this for us

### @kozlovic
> The reason is that the proxy validation was done when parsing the 'proxy' field, but there was no guarantee that this field would be parsed after 'urls'

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
