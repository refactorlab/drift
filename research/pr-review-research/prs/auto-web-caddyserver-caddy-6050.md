# caddyserver/caddy #6050 — caddytls: clientauth: leaf verifier: make trusted leaf certs source pluggable

**[View PR on GitHub](https://github.com/caddyserver/caddy/pull/6050)**

| | |
|---|---|
| **Author** | @armadi1809 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mohammed90
> This doesn't properly implement a Caddy module. The PR is not pluggable. Effectively, this still only accepts one kind of source of certificates.

### @francislavoie
> To be pluggable (in the sense of a Caddy plugin, not 'plugging data into the config'...), there needs to be an interface that a plugin could implement.

### @mohammed90
> We'll need a new interface and a new namespace...the data returned by the interface contains `tls.Certificate` while we need `x509.Certificate`.

### @francislavoie
> For client auth, we only want the cert, not the key. So they might need to be new modules.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
