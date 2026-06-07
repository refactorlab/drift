# facebook/react-native #49135 — [0.76] Bump Kotlin to 1.9.25 to mitigate #49115

**[View PR on GitHub](https://github.com/facebook/react-native/pull/49135)**

| | |
|---|---|
| **Author** | @cortinico |
| **Status** | ✅ merged |
| **Opened** | 2025-02-03 |
| **Repo importance** | ★125,961 · 25,178 forks · score 231,670 |
| **Diff** | +3 / −3 across 3 files |
| **Engagement** | 21 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @riteshshukla04 — 20 reactions  
`👍 9 · 🚀 2 · 👀 1 · 😄 8`  ·  [link](https://github.com/facebook/react-native/pull/49135#issuecomment-2634254709)

> Oops . I think I found the RCA . The JAR file contains an HTML saying that it is blocked by Ministry of electronics India. Thats why it is not working for me (and most of the complaints were from India). 
> 
> Thank you @cortinico . 
> `
> <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0"/><style>body{margin:0px;padding:0px;}iframe{width:100%;height:100%}</style><iframe src="http://210.57.203.2:8080/webadmin/deny/dot.html" width="100%" height="100%" frameborder=0></iframe>
> `
> 
> <img width="1289" alt="Screenshot 2025-02-04 at 8 35 06 PM" src="https://github.com/user-attachments/assets/50b7b5cd-6dd4-48d9-8347-f2ffec2043fc" />

### @cortinico — 5 reactions  
`👍 3 · 🎉 2`  ·  [link](https://github.com/facebook/react-native/pull/49135#issuecomment-2634621659)

> > Oops . I think I found the RCA . The JAR file contains an HTML saying that it is blocked by Ministry of electronics India. Thats why it is not working for me (and most of the complaints were from India).
> > 
> > Thank you @cortinico . `<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0"/><style>body{margin:0px;padding:0px;}iframe{width:100%;height:100%}</style><iframe src="http://210.57.203.2:8080/webadmin/deny/dot.html" width="100%" height="100%" frameborder=0></iframe>`
> > 
> > <img alt="Screenshot 2025-02-04 at 8 35 06 PM" width="1289" src="https://private-user-images.githubusercontent.com/75062358/409612241-50b7b5cd-6dd4-48d9-8347-f2ffec2043fc.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3Mzg2OTAzMjQsIm5iZiI6MTczODY5MDAyNCwicGF0aCI6Ii83NTA2MjM1OC80MDk2MTIyNDEtNTBiN2I1Y2QtNmRkNC00OGQ5LTgzNDctZjJmZmVjMjA0M2ZjLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTAyMDQlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUwMjA0VDE3MjcwNFomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWI0YTA0YzdhZTg3MThhNzIwMjgzYjQyNmNkNDdhZDYzOGUzYzJiMmUzZThjYjkxMGEwNmQyMDQ2OGUxZWJkMzkmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.s7qAQzIB3DVYl0BZLggXuZaQXu6rof1XpknjynwQlCw">
> 
> Yup that was my suspect. Not sure why they blocked that particular resource. I suspect they tried to tear down some website or product, and they were too 'greedy' in doing it. 
> 
> Anyway I've posted an official update here: https://github. … *[truncated]*

### @cortinico — 1 reactions  
`😕 1`  ·  [link](https://github.com/facebook/react-native/pull/49135#issuecomment-2631663506)

> That's what I'm seeing:
> 
> https://github.com/user-attachments/assets/91b12fde-aa99-4766-9d67-05fc9a6922d7

### @riteshshukla04 — 1 reactions  
`👍 1`  ·  [link](https://github.com/facebook/react-native/pull/49135#issuecomment-2634638259)

> > > Oops . I think I found the RCA . The JAR file contains an HTML saying that it is blocked by Ministry of electronics India. Thats why it is not working for me (and most of the complaints were from India).
> > > Thank you @cortinico . `<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0"/><style>body{margin:0px;padding:0px;}iframe{width:100%;height:100%}</style><iframe src="http://210.57.203.2:8080/webadmin/deny/dot.html" width="100%" height="100%" frameborder=0></iframe>`
> > > <img alt="Screenshot 2025-02-04 at 8 35 06 PM" width="1289" src="https://private-user-images.githubusercontent.com/75062358/409612241-50b7b5cd-6dd4-48d9-8347-f2ffec2043fc.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3Mzg2OTAzMjQsIm5iZiI6MTczODY5MDAyNCwicGF0aCI6Ii83NTA2MjM1OC80MDk2MTIyNDEtNTBiN2I1Y2QtNmRkNC00OGQ5LTgzNDctZjJmZmVjMjA0M2ZjLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTAyMDQlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUwMjA0VDE3MjcwNFomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWI0YTA0YzdhZTg3MThhNzIwMjgzYjQyNmNkNDdhZDYzOGUzYzJiMmUzZThjYjkxMGEwNmQyMDQ2OGUxZWJkMzkmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.s7qAQzIB3DVYl0BZLggXuZaQXu6rof1XpknjynwQlCw">
> > 
> > Yup that was my suspect. Not sure why they blocked that particular resource. I suspect they tried to tear down some website or product, and they were too 'greedy' in doing it.
> > 
> > Anyway I've posted an official update here: [#49115 … *[truncated]*

### @riteshshukla04 — 0 reactions  
`—`  ·  [link](https://github.com/facebook/react-native/pull/49135#issuecomment-2631490498)

> Hey @cortinico  , We also need to update the template for build.gradle. Right?

### @riteshshukla04 — 0 reactions  
`—`  ·  [link](https://github.com/facebook/react-native/pull/49135#issuecomment-2631508408)

> Also can we have a fix for 0.75 stable too? I can raise a PR if needed


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
