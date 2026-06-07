# louislam/uptime-kuma #6560 — feat: add Halo PSA webhook notification provider

**[View PR on GitHub](https://github.com/louislam/uptime-kuma/pull/6560)**

| | |
|---|---|
| **Author** | @Yasindu20 |
| **Status** | ✅ merged |
| **Opened** | 2026-01-01 |
| **Repo importance** | ★87,667 · 7,957 forks · score 124,494 |
| **Diff** | +180 / −0 across 6 files |
| **Engagement** | 40 conversation · 23 inline review comments |

## Top review comments (ranked by reactions)

### @CommanderStorm — 1 reactions  
`👍 1`  ·  [link](https://github.com/louislam/uptime-kuma/pull/6560#issuecomment-3707085941)

> > my build is running on azure and is using Portainer. I am currently on the beta build. If you know how I can test this using Portainer, that would be awesome!
> 
> Test images are not meant as production deployments.
> Please just run this on your local machine.
> 
> Idk if this works under portainer, it is rather unlikely since the image is not rootless.

### @Yasindu20 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/louislam/uptime-kuma/pull/6560#issuecomment-3707174828)

> @MrNickIE  try these
> 
> **Webhook Name:**  Uptime Kuma Monitoring
> 
> **Payload URL:** 
> This field might be READ-ONLY or auto-generated!
> 
> If it's empty: HaloPSA will generate this URL for you AFTER you save the webhook
> If it shows a URL: Copy this URL - you'll need it for Uptime Kuma later!
> 
> Example of what it might look like:
> https://yourcompany.halopsa.com/api/webhook/abc123xyz
> 
> **Webhook Type**
> Incoming Webhook
> OR
> HTTP/JSON
> OR
> REST API
> 
> **Method**
> POST
> 
>  **Content Type**
> application/json
> 
> **Authentication**
> Bearer Token
> 
> Then you'll need to:
> 
> Click the "Generate Token" or "Create Token" button
> Copy the token that appears - it looks like a long random string:
> 
>   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
> 
> ⚠️ IMPORTANT: Copy this immediately! Some systems only show it once!
> Paste it into a Notepad - you'll need this for Uptime Kuma
> 
> **Version**
> v1
> OR
> Latest OR leave it as default
> 
> Notes (Optional)
> 
> -------------------------------------------------------------------------------------------------------------------------------
> 
> After Clicking "Save" or "Create"
> You should see/get TWO things:
> 
> ✅ Webhook URL (also called "Payload URL" or "Endpoint")
> 
>    https://yourcompany.halopsa.com/api/webhook/abc123xyz
> → Copy this!
> 
> ✅ Bearer Token (also called "API Key" or "Authentication Token")
> 
>    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNT
> 
> ---------------------------
> 
> If you need more help, let me know
> Best Regards

### @Yasindu20 — 1 reactions  
`👍 1`  ·  [link](https://github.com/louislam/uptime-kuma/pull/6560#issuecomment-3707231234)

> @MrNickIE  You can choose Halo Api Bearer Token. I mentioned in above comment under Authentication.

### @MrNickIE — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/louislam/uptime-kuma/pull/6560#issuecomment-3710460611)

> I agree completely.  202 Should be considered a success on the test though.
> 
> I will work with Halo on the Runbook configuration and when I have something from them, I will share that information here for others?

### @CommanderStorm — 1 reactions  
`👍 1`  ·  [link](https://github.com/louislam/uptime-kuma/pull/6560#issuecomment-3711207207)

> We need to add the information nessesary to setup the notification provider to the frontend, yes.

### @CommanderStorm — 1 reactions  
`👍 1`  ·  [link](https://github.com/louislam/uptime-kuma/pull/6560#issuecomment-3817196977)

> We have some notification providers which include ids, that is not hard to do. Please feel free to do that PR.
> 
> As you can see in the code, the `status` can be UP, DOWN, NOTIFICATION or UNKNOWN


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
