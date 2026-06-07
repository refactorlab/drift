# ansible/ansible #85623 — Fix pip package name resolution in check mode

**[View PR on GitHub](https://github.com/ansible/ansible/pull/85623)**

| | |
|---|---|
| **Author** | @pkingstonxyz |
| **Status** | ✅ merged |
| **Opened** | 2025-08-05 |
| **Repo importance** | ★68,767 · 24,144 forks · score 170,342 |
| **Diff** | +241 / −1 across 4 files |
| **Engagement** | 17 conversation · 174 inline review comments |

## Top review comments (ranked by reactions)

### @pkingstonxyz — 0 reactions  
`—`  ·  [link](https://github.com/ansible/ansible/pull/85623#issuecomment-3207554523)

> I went ahead and spun the tests off to a separate tasks file as I felt the creation of an on-disk git repo warranted the separation. Using an empty .git directory inside where I wanted the dummy git repo needed to be didn't work, so I added in the initialization of a git repo on dist. Feels fragile though.
> 
> I noticed that there was already some package infrastructure [here at /test/integration/targets/pip/files](https://github.com/ansible/ansible/blob/9f899f94924fafeb330b1e8b18c970742da56e0d/test/integration/targets/pip/files/setup.py), but I'm hesitant to just add another subdirectory and create a smaller git repo inside of that files directory for fear of creating some kind of git submodule stuff. Any thoughts on the filesystem git repo front @webknjaz ?

### @pkingstonxyz — 0 reactions  
`—`  ·  [link](https://github.com/ansible/ansible/pull/85623#issuecomment-3233720371)

> Per #85756 it looks like this needs to be backported into 2.18+2.19


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
