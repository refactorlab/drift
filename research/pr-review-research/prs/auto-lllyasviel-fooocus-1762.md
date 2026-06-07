# lllyasviel/Fooocus #1762 — feat: adds preview overlay for styles

**[View PR on GitHub](https://github.com/lllyasviel/Fooocus/pull/1762)**

| | |
|---|---|
| **Author** | @chrisheinzelmann |
| **Status** | ✅ merged |
| **Opened** | 2024-01-05 |
| **Repo importance** | ★49,671 · 8,039 forks · score 84,255 |
| **Diff** | +59 / −1 across 282 files |
| **Engagement** | 27 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @lllyasviel — 5 reactions  
`👍 5`  ·  [link](https://github.com/lllyasviel/Fooocus/pull/1762#issuecomment-1879818413)

> i am going to merge.
> but still need to consider that increased file size of this repo since the auto update will pull all files.
> i will see if i can make extra files smaller or so

### @mashb1t — 3 reactions  
`👍 3`  ·  [link](https://github.com/lllyasviel/Fooocus/pull/1762#issuecomment-1880525818)

> @lllyasviel Is it intended that the images are now smaller in dimensions and >200% larger in file size? Did you compress the images after downscaling?
> 
> > In general, it's best practice to keep images with x2 resolution than displayed (retina).
> 
> As mentioned, it is best practice to keep images x2 the display size for upscaled outputs, so 256x256 would be ideal here when displaying as 128x128px.

### @chrisheinzelmann — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/lllyasviel/Fooocus/pull/1762#issuecomment-1879621678)

> I implemented support for other languages. I hope it works for everyone

### @mashb1t — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/lllyasviel/Fooocus/pull/1762#issuecomment-1879013500)

> @diaolulu1 please check your network tab, this may have to do with slow internet speed between you and the server (if you're using Fooocus remotely).
> If that isn't the case please check if the meta `samples-path` is correctly set to your project root, see screenshot attached:
> 
> ![Screenshot 2024-01-05 at 18 19 24](https://github.com/lllyasviel/Fooocus/assets/9307310/2f005993-fe8f-440a-8733-e2ad1bdbafc7)

### @docppp — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/lllyasviel/Fooocus/pull/1762#issuecomment-1879018184)

> Could you please merge the part you have coded to this fork:
> https://github.com/docppp/Fooocus/tree/main
> so we can keep both Style Samples and hover images (names of files are already synced with used style)?

### @mashb1t — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/lllyasviel/Fooocus/pull/1762#issuecomment-1879033326)

> @docppp i don't think that's possible for @crohrer without giving write access to your repo.
> There are a few options:
> 
> 1. you add @crohrer as maintainer to your repository (worst option)
> 2. you add the remote `git@github.com:crohrer/Fooocus.git` or https equivalent to your local git repository and merge the main branch into yours + resolve conflicts (best option)
> 3. you c&p the changes of this PR into yours, loosing the relation to the author in the process.
> 4. a collaborator / reviewer does option 3


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
