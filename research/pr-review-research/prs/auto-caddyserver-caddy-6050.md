# caddyserver/caddy #6050 — caddytls: clientauth: leaf verifier: make trusted leaf certs source pluggable

**[View PR on GitHub](https://github.com/caddyserver/caddy/pull/6050)**

| | |
|---|---|
| **Author** | @armadi1809 |
| **Status** | ✅ merged |
| **Opened** | 2024-01-18 |
| **Repo importance** | ★73,173 · 4,761 forks · score 97,210 |
| **Diff** | +649 / −4 across 12 files |
| **Engagement** | 31 conversation · 36 inline review comments |

## Top review comments (ranked by reactions)

### @mholt — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/caddyserver/caddy/pull/6050#issuecomment-1918401379)

> Thanks for working on this and so many other patches recently, @armadi1809. Could you join our developer Slack? That way you're welcome to discuss changes and other Caddy things in more real-time with our team. Just let me know which email address to send the invite to.

### @mohammed90 — 1 reactions  
`👍 1`  ·  [link](https://github.com/caddyserver/caddy/pull/6050#issuecomment-1901083406)

> > @mohammed90 , is this similar to #5784?
> 
> No. This one is for the verifiers.
> 
> Thanks, @armadi1809! I'm a bit busy this weekend, but you'll need to go through this page:
> https://caddyserver.com/docs/extending-caddy. This doesn't properly implement a Caddy module. The PR is not pluggable. Effectively, this still only accepts one kind of source of certificates. The type name and tag says certificate names", but it's just decoding DERs which means it only accepts certificates that are directly given in the configuration as DER. What if the certificates are stored in a file in the filesystem? What if I want to read them from an HTTP endpoint? This is the test of pluggable, they could come from a plugin.

### @francislavoie — 1 reactions  
`👍 1`  ·  [link](https://github.com/caddyserver/caddy/pull/6050#issuecomment-1903334017)

> Okay, it's still not what @mohammed90 was asking for - it's still not pluggable.
> 
> To be pluggable (in the sense of a Caddy plugin, not "plugging data into the config", if that was unclear), there needs to be an interface that a plugin could implement to provide info or perform a task.
> 
> Read through https://caddyserver.com/docs/extending-caddy, especially the part on namespaces & interfaces.
> 
> We want this to be a [Host Module](https://caddyserver.com/docs/extending-caddy#host-modules) which can take a guest module as input, and guest modules will load certificates in various ways (i.e. from file, or statically, or from an HTTP endpoint, or a storage plugin, etc).
> 
> For example, the `tls.client_auth` namespace takes guest modules like `tls.client_auth.*` which must conform to the `ClientCertificateVerifier` interface:
> 
> ```go
> // ClientCertificateVerifier is a type which verifies client certificates.
> // It is called during verifyPeerCertificate in the TLS handshake.
> type ClientCertificateVerifier interface {
> 	VerifyClientCertificate(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error
> }
> ```
> 
> We _do_ already have the `caddytls.CertificateLoader` interface... it might be possible to reuse that interface, under a different namespace? WDYT @mohammed90 :man_shrugging: I don't really know what's needed here, I'm just kinda scraping by on the little I understand about this stuff.

### @mohammed90 — 1 reactions  
`👍 1`  ·  [link](https://github.com/caddyserver/caddy/pull/6050#issuecomment-1903362547)

> > because they try to load a cert + key
> 
> Yeah, just looked at the code now and noticed the same thing. Re-using the existing interface won't work because the data returned by the interface, i.e. `caddytls.Certificate`, contains `tls.Certificate` while we need `x509.Certificate`.
> 
> We'll need a new interface and a new namespace.

### @mholt — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/caddyserver/caddy/pull/6050#issuecomment-1904968445)

> You're doing great! Sorry I haven't been more involved in the process lately (baby takes up my spare brain cycles and time) -- but you're on the right track. Thank you!

### @francislavoie — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/caddyserver/caddy/pull/6050#issuecomment-1906671189)

> I think we should have some built in, same as `caddytls.CertificateLoader`. Can probably copy-paste those but just adjust them to only read in certs and not keys


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
