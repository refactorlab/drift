# freeCodeCamp/freeCodeCamp #62735 — feat(curriculum): add second flexbox workshop to FSD cert

**[View PR on GitHub](https://github.com/freeCodeCamp/freeCodeCamp/pull/62735)**

| | |
|---|---|
| **Author** | @sebacodes |
| **Status** | ✅ merged |
| **Opened** | 2025-10-12 |
| **Repo importance** | ★446,089 · 44,837 forks · score 630,434 |
| **Diff** | +4463 / −0 across 46 files |
| **Engagement** | 21 conversation · 280 inline review comments |

## Top review comments (ranked by reactions)

### @Jeevankumar-s — 2 reactions  
`👍 1 · 😄 1`  ·  [link](https://github.com/freeCodeCamp/freeCodeCamp/pull/62735#issuecomment-3946869652)

> > Hi @Jeevankumar-s, thanks for the code review. I have a question regarding the indentation.
> > 
> > I made a few changes in the Challenge Editor after running `pnpm run challenge-editor`, and now I'm reviewing all the steps in VS Code. However, I noticed an indentation discrepancy between the two environments.
> > 
> > The Challenge Editor considers a TAB as 2 spaces, while VS Code treats it as 4 spaces. Which standard is the correct one to follow? I noticed this difference in several files, take the next file below as an example:
> > 
> > ```
> > id: 68ef9a0b710ba66dd23ed260
> > title: Step 38
> > challengeType: 0
> > dashedName: step-38
> > ```
> > 
> > Thanks!
> 
> Hi @sebacodes ,
> 
> In VS Code, if your indentation is set to 2 spaces, pressing Tab will insert 2 spaces instead of 4. You can check this in the bottom-right corner of VS Code (it should show Spaces: 2). If it’s different, you can click on it and change it to 2.
> 
> Also, I’d recommend using the Prettier extension. It helps keep indentation consistent across files and environments. I think the 2-space indentation you’re seeing is coming from the project’s formatting configuration (Prettier/editor settings), which the Challenge Editor follows.
> 
> <img width="1610" height="653" alt="image" src="https://github.com/user-attachments/assets/efa22790-ac47-42f9-af75-020f4d133858" />

### @jdwilkin4 — 1 reactions  
`🚀 1`  ·  [link](https://github.com/freeCodeCamp/freeCodeCamp/pull/62735#issuecomment-3413772354)

> > If this is possible. Do I just need to add a new step and then modify the .json file with the appropriate hash and step number?. And also change the number in the header of each .md file?
> 
> You should never have to manually update details like this. That will cause errors like you had before.
> It is best to use the commands listed in the docs here 
> 
> https://contribute.freecodecamp.org/how-to-work-on-workshops/#using-the-scripts-manually
> 
> Make sure to run these commands in the workshop directory. 
> 
> hope that helps

### @majestic-owl448 — 1 reactions  
`👍 1`  ·  [link](https://github.com/freeCodeCamp/freeCodeCamp/pull/62735#issuecomment-3938609679)

> maybe do not use tabs at all, it gets confusing, it's shown differently in all environments. My review on indentation was looking at the steps in the challenge pages (running `develop`).

### @sebacodes — 0 reactions  
`—`  ·  [link](https://github.com/freeCodeCamp/freeCodeCamp/pull/62735#issuecomment-3413559154)

> Step 3 became a bit overloaded with instructions, hints, and tests. This happened because I forgot to include these instructions:
> 
> - Add an `h3` element with the text `Box 1` through `Box 6`.
> - Add a `p` element with the text `Red` through `Indigo`.
> 
> Can I add new steps?, one for the `h3` elements and another for the `p` elements. This is to made a better structure for the workshop and make it more understandable.
> 
> If this is possible. Do I just need to add a new step and then modify the .json file with the appropriate hash and step number?. And also change the number in the header of each .md file?
> 
> Thank.

### @sebacodes — 0 reactions  
`—`  ·  [link](https://github.com/freeCodeCamp/freeCodeCamp/pull/62735#issuecomment-3415464807)

> Thanks Jessica, new steps added to the workshop. Now it look better

### @jdwilkin4 — 0 reactions  
`—`  ·  [link](https://github.com/freeCodeCamp/freeCodeCamp/pull/62735#issuecomment-3415938260)

> @sebacodes 
> 
> I am converting this back to draft because it hasn't been tested yet.
> 
> I pulled down your changes and ran the `FCC_BLOCK='Design a Set of Colorful Boxes' pnpm run test:curriculum:content
> ` command and it says 20 tests are failing.
> 
> You will need to resolve those. 
> 
> Also, you should run the project locally and go through each step like a camper would. 
> 
> Once you have done those things, then it will be ready for review


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
