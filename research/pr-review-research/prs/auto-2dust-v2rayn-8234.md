# 2dust/v2rayN #8234 — Cert Pinning

**[View PR on GitHub](https://github.com/2dust/v2rayN/pull/8234)**

| | |
|---|---|
| **Author** | @DHR60 |
| **Status** | ✅ merged |
| **Opened** | 2025-11-01 |
| **Repo importance** | ★107,989 · 15,228 forks · score 173,899 |
| **Diff** | +858 / −55 across 20 files |
| **Engagement** | 31 conversation · 7 inline review comments |

## Top review comments (ranked by reactions)

### @DHR60 — 2 reactions  
`👍 2`  ·  [link](https://github.com/2dust/v2rayN/pull/8234#issuecomment-3475778702)

> 内置一份 CA 指纹 Pinning，避免用户电脑已经被置入恶意 CA 获取到错误证书
> 
> 取自火狐的 CA 列表 https://hg-edge.mozilla.org/mozilla-central/raw-file/tip/security/nss/lib/ckfw/builtins/certdata.txt

### @DHR60 — 1 reactions  
`👍 1`  ·  [link](https://github.com/2dust/v2rayN/pull/8234#issuecomment-3475902026)

> 因为用户友好啊，并且 C# 有现成的类和方法
> 
> ```pwsh
> "" | openssl s_client -servername example.com -connect example.com:443 2>$null | openssl x509
> ```
> 比起这种方法更方便
> 
> 一是不需要安装 openssl，二是可以验证 CA 证书是否可信

### @DHR60 — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/8234#issuecomment-3475778884)

> 脚本如下
> ```python
> import requests
> import re
> 
> # Trusted CA Cert URL
> url = "https://hg-edge.mozilla.org/mozilla-central/raw-file/tip/security/nss/lib/ckfw/builtins/certdata.txt"
> 
> # Get Fingerprints (SHA-256) from certdata.txt
> # Fingerprint (SHA-256): EB:D4:10:40:... CKA_CLASS CK_OBJECT_CLASS ... CKA_LABEL UTF8 "GlobalSign Root CA"
> # Returns a string of fingerprints:
> # "EBD41040...", // GlobalSign Root CA
> # ...
> def get_fingerprints(url):
>     response = requests.get(url)
>     data = response.text
> 
>     # Regex to find SHA-256 fingerprints and their labels
>     pattern = r'Fingerprint \(SHA-256\): ([A-F0-9:]+).*?CKA_LABEL UTF8 "([^"]+)"'
>     matches = re.findall(pattern, data, re.DOTALL)
> 
>     # Remove duplicates while preserving first-seen order.
>     fingerprints = []
>     seen = set()
>     for match in matches:
>         # normalize fingerprint: remove colons and uppercase
>         fingerprint = match[0].replace(":", "").upper()
>         label = match[1].strip()
>         if fingerprint in seen:
>             continue
>         seen.add(fingerprint)
>         fingerprints.append(f'"{fingerprint}", // {label}')
> 
>     return fingerprints
> 
> if __name__ == "__main__":
>     fingerprints = get_fingerprints(url)
>     for fp in fingerprints:
>         print(fp)
> ```

### @2dust — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/8234#issuecomment-3475834388)

> 感谢你的 PR。
> 大概明白意思了，xray 和 sing-box 都支持 cert ；
> 但是是不是我们做的有些过多了，获取证书还需要我们做？

### @DHR60 — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/8234#issuecomment-3477452496)

> 填写证书后，底层自动禁用 AllowInsecure 吧
> 
> 一是符合目前界面说明的逻辑，二是避免用户填写了，但是 AllowInsecure = true 导致实际未使用的情况

### @DHR60 — 0 reactions  
`—`  ·  [link](https://github.com/2dust/v2rayN/pull/8234#issuecomment-3477524165)

> > 填写证书后，底层自动禁用 AllowInsecure 吧
> > 
> > 一是符合目前界面说明的逻辑，二是避免用户填写了，但是 AllowInsecure = true 导致实际未使用的情况
> 
> 所以做吗？目前是即使填了证书，AllowInsecure 还是不会去验证


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
