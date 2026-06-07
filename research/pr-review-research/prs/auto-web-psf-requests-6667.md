# psf/requests #6667 — Avoid reloading root certificates to improve concurrent performance

**[View PR on GitHub](https://github.com/psf/requests/pull/6667)**

| | |
|---|---|
| **Author** | @agubelu |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sigmavirus24
> Requests supports being run (with certifi) inside a zip file created by a tool like pants, pyinstaller, etc. The code here removes that support in loading the trust stores.

### @sigmavirus24
> I think the last blocker is the context being 'public' in how it is named. That will encourage people to modify it in a way we don't want to be supporting.

### @tiran
> SSLContext is designed to be shared and used for multiple connections. It is thread safe as long as you don't reconfigure it once it is used by a connection. Adding new certs to the internal trust store is fine, but changing ciphers, verification settings, or mTLS certs can lead to surprising behavior.

### @florianlink
> This patch has the side-effect, that it is no longer possible to pass in a custom ssl_context via the PoolManager. This is a problem because now it does not seem possible anymore to enable/use a custom ssl_context to reduce the OpenSSL seclevel used by request.

### @mm-matthias
> We've been hit by the slowness of load_verify_locations as well...after connections in the PoolManager timeout, the SSLContext is recreated over and over.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
