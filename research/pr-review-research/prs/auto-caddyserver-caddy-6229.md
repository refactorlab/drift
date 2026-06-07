# caddyserver/caddy #6229 — Upgrade: ACMEz v2, CertMagic, and ZeroSSL issuer

**[View PR on GitHub](https://github.com/caddyserver/caddy/pull/6229)**

| | |
|---|---|
| **Author** | @mholt |
| **Status** | ✅ merged |
| **Opened** | 2024-04-08 |
| **Repo importance** | ★73,173 · 4,761 forks · score 97,210 |
| **Diff** | +444 / −298 across 27 files |
| **Engagement** | 29 conversation · 8 inline review comments |

## Top review comments (ranked by reactions)

### @mholt — 2 reactions  
`🎉 2`  ·  [link](https://github.com/caddyserver/caddy/pull/6229#issuecomment-2329188799)

> @simaotwx Specifying the `zerossl` issuer will use the ZeroSSL API, which has pretty restrictive free limits. Remove the `cert_issuer` line from your config (and keep the email) to use both Let's Encrypt and ZeroSSL. To use only ZeroSSL's ACME endpoint, specify `acme_ca`, with ZeroSSL's ACME endpoint according to their documentation: https://zerossl.com/documentation/acme/. If you don't have a ZeroSSL ACME account in your storage already and you don't specify your email address, you'll need to specify your EAB credentials as well:
> 
> ```
> {
> 	acme_ca https://acme.zerossl.com/v2/DV90
> 
> 	# if you don't specify an email:
> 	acme_eab {
> 		key_id ...
> 		mac_key ...
> 	}
> 
> 	# but specifying an email instead is recommended
> 	email email@example.com 
> }
> ```

### @simaotwx — 2 reactions  
`❤️ 1 · 🎉 1`  ·  [link](https://github.com/caddyserver/caddy/pull/6229#issuecomment-2329345185)

> > @simaotwx Specifying the `zerossl` issuer will use the ZeroSSL API, which has pretty restrictive free limits. Remove the `cert_issuer` line from your config (and keep the email) to use both Let's Encrypt and ZeroSSL. To use only ZeroSSL's ACME endpoint, specify `acme_ca`, with ZeroSSL's ACME endpoint according to their documentation: https://zerossl.com/documentation/acme/. If you don't have a ZeroSSL ACME account in your storage already and you don't specify your email address, you'll need to specify your EAB credentials as well:
> 
> Thank you! Your reply couldn't have been more clear.

### @devsnek — 1 reactions  
`👀 1`  ·  [link](https://github.com/caddyserver/caddy/pull/6229#issuecomment-2044132658)

> I tried running this and I'm seeing this error for IP subjects:
> ```
> tls.obtain	will retry	{"error": "[94.26.24.128] Obtain: subject does not qualify for a public certificate: 94.26.24.128", "attempt": 1, "retrying_in": 60, "elapsed": 0.000330948, "max_duration": 2592000}
> ```
> does this check need to be bypassed for the zerossl issuer?

### @devsnek — 1 reactions  
`👍 1`  ·  [link](https://github.com/caddyserver/caddy/pull/6229#issuecomment-2053595540)

> seems ipv6 does not currently work though
> ```
> 2024/04/13 09:48:33.065	ERROR	tls.obtain	could not get certificate from issuer	{"identifier": "2a14:14c0:0:10::", "issuer": "zerossl", "error": "creating certificate: POST https://api.zerossl.com/certificates?access_key=redacted: HTTP 200: API error 2808: invalid_certificate_domain (details=map[]) (raw={\"success\":false,\"error\":{\"code\":2808,\"type\":\"invalid_certificate_domain\"}} decode_error=json: unknown field \"success\")"}
> 2024/04/13 09:48:33.065	ERROR	tls.obtain	will retry	{"error": "[2a14:14c0:0:10::] Obtain: creating certificate: POST https://api.zerossl.com/certificates?access_key=redacted: HTTP 200: API error 2808: invalid_certificate_domain (details=map[]) (raw={\"success\":false,\"error\":{\"code\":2808,\"type\":\"invalid_certificate_domain\"}} decode_error=json: unknown field \"success\")", "attempt": 1, "retrying_in": 60, "elapsed": 1.387451133, "max_duration": 2592000}
> ```
> i played around on the zerossl site for a bit and it seems like it only accepts the address in the expanded form: `2a14:14c0:0000:0010:0000:0000:0000:0000`

### @mholt — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/caddyserver/caddy/pull/6229#issuecomment-2147446226)

> > behaviour using Caddyfile is way different from that of the JSON config 👍
> 
> Yes, so in the [release notes](https://github.com/caddyserver/caddy/releases/tag/v2.8.0) we boil it down:
> 
> > If you use JSON to configure certificate automation policies, you will need to ensure you use the [acme issuer with your email filled out](https://caddyserver.com/docs/json/apps/tls/automation/policies/issuers/acme/#email), and the [ca field](https://caddyserver.com/docs/json/apps/tls/automation/policies/issuers/acme/#ca) set to [ZeroSSL's ACME server URL](https://zerossl.com/documentation/acme/).
> 
> Hopefully that's clear. EDIT: I see why maybe it's not clear when talking about redundancy (multiple ACME CAs). I've edited the wording of the release notes.
> 
> So yeah, your updated config looks like what you want. Try ACME with Let's Encrypt first, then ACME with ZeroSSL after. And the ZeroSSL one has an email address. :100:

### @simaotwx — 1 reactions  
`👍 1`  ·  [link](https://github.com/caddyserver/caddy/pull/6229#issuecomment-2340446543)

> For anyone interested, this is how it looks like now:
> 
> ```
> 	acme_ca https://acme.zerossl.com/v2/DV90
> 	acme_eab {
> 		key_id {$ZEROSSL_KID}
> 		mac_key {$ZEROSSL_HMAC_KEY}
> 	}
> ```
> 
> The `cert_issuer` definitely needs to be removed, otherwise it won't work.
> 
> Both variables are passed from outside (Terraform -> Packer -> .env -> docker compose -> docker -> Caddy)
> 
> If anyone needs a way to generate the EAB credentials in Terraform to then pass it all the way through to Caddy, you can use our provider for this:  https://registry.terraform.io/providers/toowoxx/zerossl/latest/docs/resources/eab_credentials
> 
> I made this provider two years ago and realized I didn't actually need it but now it proved to be useful.
> 
> The alternative to this is to upgrade the subscription and use the API through Caddy for which EAB credentials are not needed (just the API token).


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
