# caddyserver/caddy #6229 — Upgrade: ACMEz v2, CertMagic, and ZeroSSL issuer

**[View PR on GitHub](https://github.com/caddyserver/caddy/pull/6229)**

| | |
|---|---|
| **Author** | @mholt |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @devsnek
> does this check need to be bypassed for the zerossl issuer?

### @mholt
> I might need to update the logic regarding IP certs. I think it's still true for ACME but I need to double check on CA policies these days.

### @devsnek
> i played around on the zerossl site for a bit and it seems like it only accepts the address in the expanded form: `2a14:14c0:0000:0010:0000:0000:0000:0000`

### @mholt
> Caddy does what you configure it to do, so if you tell it to use ZeroSSL as the issuer it will use ZeroSSL. If you want to use multiple issuers then be sure to add them to your configuration.

### @mholt
> Specifying the `zerossl` issuer will use the ZeroSSL API, which has pretty restrictive free limits. Remove the `cert_issuer` line from your config (and keep the email) to use both Let's Encrypt and ZeroSSL.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
