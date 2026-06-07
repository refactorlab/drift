# AUTOMATIC1111/stable-diffusion-webui #15600 — Fix corrupt model initial load loop

**[View PR on GitHub](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/15600)**

| | |
|---|---|
| **Author** | @w-e-w |
| **Status** | ✅ merged |
| **Opened** | 2024-04-22 |
| **Repo importance** | ★163,453 · 30,371 forks · score 288,635 |
| **Diff** | +17 / −15 across 2 files |
| **Engagement** | 19 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @FurkanGozukara — 1 reactions  
`👍 1`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/15600#issuecomment-2075080298)

> > @Zespina delete the corrupted model that's causing issue
> 
> No it is not corrupted model error
> 
> Happened to me as well and after trying several times fixed
> 
> There is certainly a bug

### @1637561204 — 0 reactions  
`—`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/15600#issuecomment-2072894374)

> Adding “Return” to the first line of modules/sd_models.py solves the problem.
> ![1713890188788](https://github.com/AUTOMATIC1111/stable-diffusion-webui/assets/56059148/3862ccb6-b48d-49f0-b604-4f2beb509cbe)

### @w-e-w — 0 reactions  
`—`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/15600#issuecomment-2072910092)

> > Adding “Return” to the first line of modules/sd_models.py solves the problem.
> 
> ??????

### @1637561204 — 0 reactions  
`—`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/15600#issuecomment-2072918507)

> > > Adding “Return” to the first line of modules/sd_models.py solves the problem.
> > 
> > ??????
> 
> After adding“Return”, you can select the model.

### @1637561204 — 0 reactions  
`—`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/15600#issuecomment-2072924828)

> > > > Adding “Return” to the first line of modules/sd_models.py solves the problem.
> > > 
> > > 
> > > ??????
> > 
> > After adding“Return”, you can select the model.
> When you can select the model, you can delete“Return”

### @w-e-w — 0 reactions  
`—`  ·  [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui/pull/15600#issuecomment-2072935183)

> you realize this is a pull request not an issue post


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
