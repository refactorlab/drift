# coollabsio/coolify #5386 — feat(service): add signoz template

**[View PR on GitHub](https://github.com/coollabsio/coolify/pull/5386)**

| | |
|---|---|
| **Author** | @GauthierPLM |
| **Status** | ✅ merged |
| **Opened** | 2025-03-20 |
| **Repo importance** | ★56,503 · 4,719 forks · score 80,375 |
| **Diff** | +657 / −0 across 2 files |
| **Engagement** | 48 conversation · 35 inline review comments |

## Top review comments (ranked by reactions)

### @GauthierPLM — 13 reactions  
`❤️ 9 · 🎉 4`  ·  [link](https://github.com/coollabsio/coolify/pull/5386#issuecomment-3407485229)

> Hi @ShadowArcanist 
> 
> I pushed the requested changes plus opened a PR to the doc repository, for which I made a quick edit of my blog post, removing irrelevant parts / instructions that I assume Coolify users know (such as adding new environment variables).
> 
> Hope this PR gets finally accepted. :)

### @Nageshbansal — 8 reactions  
`👍 8`  ·  [link](https://github.com/coollabsio/coolify/pull/5386#issuecomment-3048120643)

> Hey @peaklabs-dev, could you please review this PR again

### @GauthierPLM — 6 reactions  
`👍 3 · 🎉 3`  ·  [link](https://github.com/coollabsio/coolify/pull/5386#issuecomment-3274236160)

> Hi everyone :)
> 
> I updated the template to integrated the latest changes from SigNoz.
> I also prepared a [dev.to post](https://dev.to/gauthierplm/use-coolify-to-self-host-signoz-1h6b) to help you setup SigNoz.

### @andrasbacsai — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/coollabsio/coolify/pull/5386#issuecomment-2866049765)

> It was a mistake, sorry. I recreated the `next` branch and it auto-closed this PR.

### @lamongabriel — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/coollabsio/coolify/pull/5386#issuecomment-3438508643)

> I solved it by giving permissions to the volume as well. Might not be the most elegant solution but it worked
> 
> chmod 644 /data/coolify/services/q8k8so08k0ogs8sc4gg008cs/otel-collector-config.yaml
> chmod 644 /data/coolify/services/q8k8so08k0ogs8sc4gg008cs/otel-collector-opamp-config.yaml
> 
> The problem with doing it this way is that Coolify seems to restore the file permissions if you click restart, I assume it is replacing the files in the folder.
> 
> The solution was to docker compose down, and docker compose up -d inside the folder

### @GauthierPLM — 1 reactions  
`👍 1`  ·  [link](https://github.com/coollabsio/coolify/pull/5386#issuecomment-2747412898)

> @pkudinov in this case, I will keep them no exposed and will let users do the setup would it be needed. This will follow the official behavior and (hopefully) save some confusion.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
