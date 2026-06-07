# google-gemini/gemini-cli #26361 — fix(core): externalize https-proxy-agent to fix proxy support

**[View PR on GitHub](https://github.com/google-gemini/gemini-cli/pull/26361)**

| | |
|---|---|
| **Author** | @sotokisehiro |
| **Status** | ✅ merged |
| **Opened** | 2026-05-02 |
| **Repo importance** | ★104,966 · 13,991 forks · score 165,925 |
| **Diff** | +188 / −0 across 4 files |
| **Engagement** | 34 conversation · 77 inline review comments |

## Top review comments (ranked by reactions)

### @scidomino — 1 reactions  
`👍 1`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/26361#issuecomment-4423601546)

> I am not a fan of this change. It seems very hacky in a couple ways. 
> 
> What if instead we did something like:
> 
> ```typescript
> import { HttpsProxyAgent } from 'https-proxy-agent';
> import { HttpProxyAgent } from 'http-proxy-agent';
> 
> // ... inside createContentGenerator ...
> const proxyUrl = config.getProxy();
> let agent: Agent = undefined;
> if (proxyUrl) {
>   const isHttp = proxyUrl.startsWith('http://');
>   agent = isHttp ? new HttpProxyAgent(proxyUrl) : new HttpsProxyAgent(proxyUrl);
> }
> 
> const googleGenAI = new GoogleGenAI({
>   apiKey: config.apiKey,
>   httpOptions: { 
>     headers,
>     agent // Pass the pre-instantiated agent here
>   },
> });
> ```
> 
> by passing in a statically imported version, you wouldn't have to worry about dynamic imports at all.

### @sotokisehiro — 0 reactions  
`—`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/26361#issuecomment-4365412811)

> I have confirmed that it works in a Windows environment.

### @sotokisehiro — 0 reactions  
`—`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/26361#issuecomment-4367864485)

> @gemini-cli-robot This PR unblocks all users who are currently unable to access Vertex AI due to proxy issues.

### @sotokisehiro — 0 reactions  
`—`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/26361#issuecomment-4409480238)

> @gemini-code-assist 
> My pull request and the other pull request (https://github.com/google-gemini/gemini-cli/pull/26551) seem to be duplicates, don't they?

### @sotokisehiro — 0 reactions  
`—`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/26361#issuecomment-4416327799)

> @scidomino I apologize for the sudden mention. We have been unable to use Vertex AI via proxy for more than a month, which is causing a major blocker for many users (over 1,000 people in my organization alone). My PR addressing this is due to be closed in 6 days. Could you please consider adding it to the roadmap or marking it as "help wanted" to prevent it from expiring? Thank you for your help.

### @scidomino — 0 reactions  
`—`  ·  [link](https://github.com/google-gemini/gemini-cli/pull/26361#issuecomment-4432376440)

> Make sure to sign the CLA, otherwise, we can't merge it.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
