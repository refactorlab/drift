# dani-garcia/vaultwarden #5626 — Abstract persistent files through Apache OpenDAL

**[View PR on GitHub](https://github.com/dani-garcia/vaultwarden/pull/5626)**

| | |
|---|---|
| **Author** | @txase |
| **Status** | ✅ merged |
| **Opened** | 2025-02-21 |
| **Repo importance** | ★61,897 · 2,883 forks · score 78,170 |
| **Diff** | +1467 / −198 across 19 files |
| **Engagement** | 38 conversation · 24 inline review comments |

## Top review comments (ranked by reactions)

### @Xuanwo — 6 reactions  
`❤️ 6`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/5626#issuecomment-2922806146)

> Hi everyone, I'm one of the maintainers of OpenDAL. Thank you all so much for trusting OpenDAL. It's truly fascinating to see OpenDAL being used in one of the products I use every day.
> 
> Feel free to AT me directly if you discover any bugs or have feature requests related to OpenDAL or storage services that I can help with.
> 
> cc @dani-garcia and @txase.

### @fxzxmicah — 5 reactions  
`👍 5`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/5626#issuecomment-3124771110)

> Why is it only for AWS instead of the general S3 standard? Otherwise, my hostility towards this feature would be a bit less.
> Another source of my hostility towards this feature is that there are quite a few tools that can work with Vaultwarden to achieve similar things. So, do we really need to implement it again in Vaultwarden?
> Moreover, based on this development trend, I can't even imagine how many different backends there will be in the future, turning it into another Rclone (not to belittle Rclone).
> Finally, I really can't imagine what use this feature has (or rather, its usefulness is too limited), because after all, it can't upload all files to AWS.
> 
> EDIT: I just read #5591 and understood what you're trying to do. It also answers some of the questions I raised above. However, I don't even think these kind of abilities specialized for a specific cloud platform should be merged into the upstream. Instead, it should exist as a separate project.
> 
> EDIT: If AWS has donated to this project, please ignore all my remarks.

### @BlackDex — 3 reactions  
`👍 3`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/5626#issuecomment-2675322698)

> > I fixed all the GHA check issues so they pass. No material changes were made.
> 
> Might want to install `pre-commit`, it will help on catching those before you push 😀.

### @txase — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/5626#issuecomment-2910769066)

> I just rebased and pushed up new commits. No changes other than addressing rebase collisions. This should be good to go!
> 
> I also gave you, maintainers of vaultwarden, permission to edit my branch should you need it.

### @BlackDex — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/5626#issuecomment-2922833057)

> @Xuanwo Thanks for your kind words. I use OpenDAL also everyday, though not physically but via rustic for my backups.
> That is how i encountered OpenDAL and when @txase created something in line without it, I instantly thought of OpenDAL.
> 
> I'm glad @txase was willing to adjust and use this and created a PR. And thanks for the offer to help out when there are issues.

### @txase — 1 reactions  
`👍 1`  ·  [link](https://github.com/dani-garcia/vaultwarden/pull/5626#issuecomment-2674765700)

> No, they can’t all be abstracted through opendal, nor should they be. You don’t want your entire sqlite db to be streamed back and forth to s3 on every record change, for example. One could also imagine tmp files could go through opendal, but it doesn’t make sense to do so even if it’s possible.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
