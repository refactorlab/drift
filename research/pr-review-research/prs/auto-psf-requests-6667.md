# psf/requests #6667 — Avoid reloading root certificates to improve concurrent performance

**[View PR on GitHub](https://github.com/psf/requests/pull/6667)**

| | |
|---|---|
| **Author** | @agubelu |
| **Status** | ✅ merged |
| **Opened** | 2024-03-20 |
| **Repo importance** | ★54,033 · 9,945 forks · score 98,797 |
| **Diff** | +28 / −18 across 1 files |
| **Engagement** | 21 conversation · 2 inline review comments |

## Top review comments (ranked by reactions)

### @tiran — 3 reactions  
`👍 3`  ·  [link](https://github.com/psf/requests/pull/6667#issuecomment-2094634639)

> `SSLContext` is designed to be shared and used for multiple connections. It is thread safe as long as you don't reconfigure it once it is used by a connection. Adding new certs to the internal trust store is fine, but changing ciphers, verification settings, or mTLS certs can lead to surprising behavior. The problem is unrelated to threads and can even occur in a single-threaded program.
> 
> If you don't trust me, then please trust David Benjamin's [statement](https://github.com/openssl/openssl/issues/2165#issuecomment-270007943) on threading. He is the main lead behind BoringSSL and did a lot of TLS stuff in Chrome browser.

### @florianlink — 3 reactions  
`👍 3`  ·  [link](https://github.com/psf/requests/pull/6667#issuecomment-2124283071)

> This patch has the side-effect, that it is no longer possible to pass in a custom ssl_context via the PoolManager.
> This is a problem because now it does not seem possible anymore to enable/use a custom ssl_context to reduce the OpenSSL seclevel used by request. The following worked in 2.31.0 and stopped working now:
> 
> ```
> from urllib3.util import create_urllib3_context
> from urllib3 import PoolManager
> from requests.adapters import HTTPAdapter
> from requests import Session
> 
> class AddedCipherAdapter(HTTPAdapter):
>   def init_poolmanager(self, *args, **kwargs):
>     print("using poolmanager")
>     ctx = create_urllib3_context(ciphers="ALL:@SECLEVEL=0")
>     kwargs['ssl_context'] = ctx
>     return super(AddedCipherAdapter, self).init_poolmanager(*args, **kwargs)
> 
> # use our own post session with lowered seclevel adapter
> def post(url, cert=None, data=None, verify=True, headers=None):
>   with Session() as s:
>     s.adapters.pop("https://", None)
>     s.mount("https://", AddedCipherAdapter())
>     return s.post(url, cert=cert, data=data,verify=verify, headers=headers)
> ```
> This worked in 2.31.0 and stopped working, because custom 'ssl_context' is overwritten by default 'ssl_context' with this merge request.
> 
> I think it would be good to support a custom ssl_context again, since otherwise it does not seem to be possible to change the seclevel settings of python requests anymore and that is required if you are working with legacy code and old certificates that can't easily be renewed.

### @nateprewitt — 2 reactions  
`👍 2`  ·  [link](https://github.com/psf/requests/pull/6667#issuecomment-2113617944)

> We don't have solidified dates for 2.32.0 but I would wager it's sometime in mid-late June. As for a pre-release, time permitting I'll take a look at it but can't guarantee anything currently.

### @agubelu — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/psf/requests/pull/6667#issuecomment-2115438382)

> @cyberw I remember doing some profiling on Windows as well and finding out that it was particularly infamous there, because the certificates were being reloaded not one, but two or three times per request. I don't recall the specific reason since I ran most of the experiments on Linux afterwards, but I think it had to do with the CA store being a folder instead of a bundle file.
> 
> In any case, hopefully this mitigates the issue now that it's merged. If not, feel free to ping me and I'll try to follow up with something more specific for Windows.

### @mm-matthias — 0 reactions  
`—`  ·  [link](https://github.com/psf/requests/pull/6667#issuecomment-2094533553)

> We've been hit by the slowness of `load_verify_locations` as well. After turning `request.get` into `session.get` performances improves a lot. But we still face the performance hit, because:
> - it happens on the first connection (vs. module init time). This creates noise in our live profiles.
> - after connections in the `PoolManager`/`HTTPConnectionPool` time out, the SSLContext is recreated over and over
> - `HTTPConnectionPool`s are keyed by host/scheme/... which means a new SSLContext is created for each pool
> - we use `session.get(proxies={...})` which leads to even more pools and SSLContext initializations (this part might not yet be covered by this PR)
> 
> Is there anything I can do to advance this PR?

### @sigmavirus24 — 0 reactions  
`—`  ·  [link](https://github.com/psf/requests/pull/6667#issuecomment-2094542956)

> Given this breaks the behavior of the module for a whole class of users as it's written today, there's not much to do to advance it. 
> 
> Even still, I'm pretty sure SSLComtext is not itself thread safe but I need to find a reference for that so loading it at the module will likely cause issues


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
