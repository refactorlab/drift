# daytonaio/daytona #1146 — feat: commit signing using ssh and gpg

**[View PR on GitHub](https://github.com/daytonaio/daytona/pull/1146)**

| | |
|---|---|
| **Author** | @divanshu-go |
| **Status** | ✅ merged |
| **Opened** | 2024-09-24 |
| **Repo importance** | ★72,501 · 5,619 forks · score 99,977 |
| **Diff** | +1060 / −146 across 40 files |
| **Engagement** | 29 conversation · 162 inline review comments |

## Top review comments (ranked by reactions)

### @divanshu-go — 0 reactions  
`—`  ·  [link](https://github.com/daytonaio/daytona/pull/1146#issuecomment-2371766644)

> @Tpuljak 
> ![image](https://github.com/user-attachments/assets/6c7abe36-2fcd-4118-bf46-08f991588a18)
> can you please assist here. I am succesfull in adding  git provider but these values are not getting stored and am  not able to understand what to do

### @Tpuljak — 0 reactions  
`—`  ·  [link](https://github.com/daytonaio/daytona/pull/1146#issuecomment-2373313599)

> > @Tpuljak ![image](https://private-user-images.githubusercontent.com/180667632/370372519-6c7abe36-2fcd-4118-bf46-08f991588a18.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MjcyNTA1OTksIm5iZiI6MTcyNzI1MDI5OSwicGF0aCI6Ii8xODA2Njc2MzIvMzcwMzcyNTE5LTZjN2FiZTM2LTJmY2QtNDExOC1iZjQ2LTA4Zjk5MTU4OGExOC5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjQwOTI1JTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI0MDkyNVQwNzQ0NTlaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT02MTM4NDY0ZjU0ZWQ4MTQxNGZjN2NiNDVkNmExMjY3ODUwNWM2ZDU0OTRmMmY5MGIxNDJiZDYwZTBmODkwM2QxJlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCJ9.--sUbw1KVY5fXDJCENxpT5CEA3eJ_pMmT37ZxsODOzc) can you please assist here. I am succesfull in adding git provider but these values are not getting stored and am not able to understand what to do
> 
> @bryans-go from what I can see, you don't pass the properties from `SetGitProviderConfig` to `GitProviderConfig` here https://github.com/daytonaio/daytona/blob/main/pkg/api/controllers/gitprovider/gitprovider.go#L134

### @divanshu-go — 0 reactions  
`—`  ·  [link](https://github.com/daytonaio/daytona/pull/1146#issuecomment-2378363859)

> [![asciinema](https://asciinema.org/a/oAxa76MdUpj252l555OADd3AC.png)](https://asciinema.org/a/oAxa76MdUpj252l555OADd3AC)

### @divanshu-go — 0 reactions  
`—`  ·  [link](https://github.com/daytonaio/daytona/pull/1146#issuecomment-2378366049)

> ![image](https://github.com/user-attachments/assets/a5a7831c-cc8f-4d78-a082-b09e5e70c5ab)
> ---
> ![image](https://github.com/user-attachments/assets/6b60cb5d-ffa2-4528-ab55-2e0f29fc77ec)
> now the ssh signing is working perfectly @Tpuljak 
> Some of the git providers does not show verified commits bagde even on signed commits by git while some also dont have proper docs on this . what should we do there ?

### @Tpuljak — 0 reactions  
`—`  ·  [link](https://github.com/daytonaio/daytona/pull/1146#issuecomment-2378619564)

> > Some of the git providers does not show verified commits bagde even on signed commits by git while some also dont have proper docs on this . what should we do there ?
> 
> Could you let us know which providers don't show the verified badge but should?
> 
> P.S. Nice work on the solution!

### @divanshu-go — 0 reactions  
`—`  ·  [link](https://github.com/daytonaio/daytona/pull/1146#issuecomment-2379169843)

> https://jira.atlassian.com/browse/BCLOUD-3166. Bitbucket doesn't have this feature yet and gitness don't have a proper docs on ssh and gpg signing while


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
