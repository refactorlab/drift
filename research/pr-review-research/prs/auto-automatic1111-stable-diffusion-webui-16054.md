# AUTOMATIC1111/stable-diffusion-webui #16054 — Fix sampler scheduler autocorrection warning

**[View PR on GitHub](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/16054)**

| | |
|---|---|
| **Author** | @w-e-w |
| **Status** | ✅ merged |
| **Opened** | 2024-06-20 |
| **Repo importance** | ★163,453 · 30,371 forks · score 288,635 |
| **Diff** | +3 / −4 across 2 files |
| **Engagement** | 23 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @BurnZeZ — 1 reactions  
`👍 1`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/16054#issuecomment-2184075490)

> Yeah, it makes it seem like it’s switching to a different scheduler.

### @DotPoker2 — 0 reactions  
`—`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/16054#issuecomment-2241303650)

> i'm still getting this warning even after newest patch, i know Euler wasn't fixed, but it's the main one i use, and to see it still have the autocorrect issue is beyond annoying
> ![Screenshot (136)](https://github.com/user-attachments/assets/04203291-8a12-4642-b10f-e36ec6dbb7d1)
> ![Screenshot (137)](https://github.com/user-attachments/assets/c56d4fd8-0392-4b3a-a629-c7790b53905f)

### @w-e-w — 0 reactions  
`—`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/16054#issuecomment-2241449935)

> > i'm still getting this warning even after newest patch, i know Euler wasn't fixed, but it's the main one i use, and to see it still have the autocorrect issue is beyond annoying
> 
> @DotPoker2 send me a screenshort of your UI before you click generate
> I want to see you sampler scheduler inputs
> ![image](https://github.com/user-attachments/assets/b57175d8-f2ab-4dd0-9616-eacee54b3993)
> 
> from what I can see
> ```
> Sampler Scheduler autocorrection: "Euler a" -> "Euler a", "None" -> "Automatic"'
> ```
> it is is working as intended
> `None` is not a valid scheduler name and so autocorrection change it to `Automatic`
> 
> ---
> 
> try disabling all extensions for now
> ![image](https://github.com/user-attachments/assets/cb88fd37-caf0-49e8-9291-8a6f97b1ee40)
> I'm suspecting that you're using an extension which does not have scheduler input
> if thisis the case if it weren't for the autocorrect, it would just error and not continue on

### @DotPoker2 — 0 reactions  
`—`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/16054#issuecomment-2241453998)

> > > i'm still getting this warning even after newest patch, i know Euler wasn't fixed, but it's the main one i use, and to see it still have the autocorrect issue is beyond annoying
> > 
> > @DotPoker2 send me a screenshort of your UI before you click generate I want to see you sampler scheduler inputs ![image](https://private-user-images.githubusercontent.com/40751091/350735727-b57175d8-f2ab-4dd0-9616-eacee54b3993.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MjE1MzQyMzIsIm5iZiI6MTcyMTUzMzkzMiwicGF0aCI6Ii80MDc1MTA5MS8zNTA3MzU3MjctYjU3MTc1ZDgtZjJhYi00ZGQwLTk2MTYtZWFjZWU1NGIzOTkzLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNDA3MjElMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjQwNzIxVDAzNTIxMlomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTRkMWY1MDFhNGYzMmNiOTY3ZDNkYWJjZTg0MTk1YzBiNTU3Y2I2NmE2YjdmYjMwMTg4ZTNiZTIxNjlhNDI5NDUmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JmFjdG9yX2lkPTAma2V5X2lkPTAmcmVwb19pZD0wIn0.UpYCVcnFC1B3Jaz8GolQtR9ObMlhs9MLw_5qZVyOY0o)
> > 
> > from what I can see
> > 
> > ```
> > Sampler Scheduler autocorrection: "Euler a" -> "Euler a", "None" -> "Automatic"'
> > ```
> > 
> > it is is working as intended `None` is not a valid scheduler name and so autocorrection change it to `Automatic`
> > 
> > try disabling all extensions for now ![image](https://private-user-images.githubusercontent.com/40751091/350735776-cb88fd37-caf0-49e8-9291-8a6f97b1ee40.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwi … *[truncated]*

### @DotPoker2 — 0 reactions  
`—`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/16054#issuecomment-2241462599)

> > did you try disabling all extensions?
> 
> i'll try it, but i doubt that's the solution, will update you if it works or not.

### @w-e-w — 0 reactions  
`—`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/16054#issuecomment-2241462722)

> btw https://github.com/KohakuBlueleaf/LyCORIS.git is not an extension
> at best it does nothing at worst it break stuff
> **remove it**


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
