# strapi/strapi #22466 — chore: use rollup & nx watch mode

**[View PR on GitHub](https://github.com/strapi/strapi/pull/22466)**

| | |
|---|---|
| **Author** | @alexandrebodin |
| **Status** | ✅ merged |
| **Opened** | 2024-12-18 |
| **Repo importance** | ★72,316 · 9,752 forks · score 116,323 |
| **Diff** | +2389 / −1786 across 336 files |
| **Engagement** | 17 conversation · 46 inline review comments |

## Top review comments (ranked by reactions)

### @Convly — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/strapi/strapi/pull/22466#issuecomment-2616221959)

> (hopefully) Fixed in c4796a8 and triggered another xp at https://github.com/strapi/strapi/actions/runs/12993386971

### @alexandrebodin — 1 reactions  
`👍 1`  ·  [link](https://github.com/strapi/strapi/pull/22466#issuecomment-2619027958)

> Ok @innerdvations I just pushed again if you want to test it wasn't happy becuse the core pkg only had the `exports` key and no root `types` key.

### @alexandrebodin — 0 reactions  
`—`  ·  [link](https://github.com/strapi/strapi/pull/22466#issuecomment-2596159371)

> > Is there a reason in some rollup.config files you `import path from 'path'` and other times `'node:path'`?
> > 
> > I get some errors related to `path` receiving `undefined` in some rollup config files when ever build:code is called...but I'm guessing you don't have that on your end 🤔 :
> > 
> > <img alt="Screenshot 2025-01-16 at 16 54 15" width="1087" src="https://private-user-images.githubusercontent.com/26598053/403941376-d24fa3f0-b5d0-4003-b664-0c93fee8ca18.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MzcwNDQ3MjIsIm5iZiI6MTczNzA0NDQyMiwicGF0aCI6Ii8yNjU5ODA1My80MDM5NDEzNzYtZDI0ZmEzZjAtYjVkMC00MDAzLWI2NjQtMGM5M2ZlZThjYTE4LnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTAxMTYlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUwMTE2VDE2MjAyMlomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWRkM2MwNzRkNWM2Mjg4MzUzNjY4YzZjMTBlMmVkZjAxMDNlOGI0MjE5YmViMTE5NWUxNDE1NDVjMTE5ZDhiNTYmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.AQQ1jz3Ss0uVM7iwIMGY9xHuIR83y4jR1sI5oaBfQuY"> <img alt="Screenshot 2025-01-16 at 16 56 47" width="1085" src="https://private-user-images.githubusercontent.com/26598053/403941427-6bc5f403-3825-4a9b-9844-4e366481229a.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MzcwNDQ3MjIsIm5iZiI6MTczNzA0NDQyMiwicGF0aCI6Ii8yNjU5ODA1My80MDM5NDE0MjctNmJjNWY0MDMtMzgyNS00YTliLTk4NDQtNGUzNjY0ODEyMjlhLnBuZz9YLUFtei1BbGdvcml0aG09QV … *[truncated]*

### @markkaylor — 0 reactions  
`—`  ·  [link](https://github.com/strapi/strapi/pull/22466#issuecomment-2597916238)

> > nope that's supposed to be equivalent. What version of node are you using ?
> 
> v20.0.0

### @MarionLemaire — 0 reactions  
`—`  ·  [link](https://github.com/strapi/strapi/pull/22466#issuecomment-2609893951)

> Tested today : 
> I've tested the Admin and everything went smooth.
> I did a quick QA round on the CTB, CM and MediaLib for safety, everything was fine except one random error at the first entry creation of my new CT (see screenshot) but just refreshing solved the problem.
> Only thing I can report, but I have no idea if this could be related to the PR or to my new Mac setup still to be improved, is that I faced many issues about building Sharp when starting to launch my app, and many dependency conflits.
> <img width="867" alt="Screenshot 2025-01-23 at 14 56 24" src="https://github.com/user-attachments/assets/bb01c80f-400f-41a4-b84f-d299d2892f89" />

### @alexandrebodin — 0 reactions  
`—`  ·  [link](https://github.com/strapi/strapi/pull/22466#issuecomment-2609906732)

> > Tested today : I've tested the Admin and everything went smooth. I did a quick QA round on the CTB, CM and MediaLib for safety, everything was fine except one random error at the first entry creation of my new CT (see screenshot) but just refreshing solved the problem. Only thing I can report, but I have no idea if this could be related to the PR or to my new Mac setup still to be improved, is that I faced many issues about building Sharp when starting to launch my app, and many dependency conflits. <img alt="Screenshot 2025-01-23 at 14 56 24" width="867" src="https://private-user-images.githubusercontent.com/97893822/406059261-bb01c80f-400f-41a4-b84f-d299d2892f89.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3Mzc2NDE2NjAsIm5iZiI6MTczNzY0MTM2MCwicGF0aCI6Ii85Nzg5MzgyMi80MDYwNTkyNjEtYmIwMWM4MGYtNDAwZi00MWE0LWI4NGYtZDI5OWQyODkyZjg5LnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTAxMjMlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUwMTIzVDE0MDkyMFomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTc0ZTA5MjM3MzJjNGRmNjAzZjhhYjZhZWI5MTYxMzI4YWE2NmM2MTVlNmExY2EwZDM4NDBkNDI2ZmVmNjVkYTYmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.aJYdRA1DLGblTBX7aG-L9XccRn-DSiwRnrnZdcc570o">
> 
> thanks I'll be able to look into it !


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
