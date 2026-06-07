# angular/angular #66655 — docs: add signal forms async operations guide

**[View PR on GitHub](https://github.com/angular/angular/pull/66655)**

| | |
|---|---|
| **Author** | @bencodezen |
| **Status** | ✅ merged |
| **Opened** | 2026-01-20 |
| **Repo** | curated review-culture seed |
| **Diff** | +559 / −0 across 2 files |
| **Engagement** | 12 conversation · 56 inline review comments |

## Top review comments (ranked by reactions)

### @JeanMeche — 1 reactions  
`👍 1`  ·  [link](https://github.com/angular/angular/pull/66655#issuecomment-3806150077)

> Looks like we need a rebase to generate the preview

### @bencodezen — 1 reactions  
`😄 1`  ·  [link](https://github.com/angular/angular/pull/66655#issuecomment-3922583508)

> > The GitHub UI always seems ambiguous to me. Was this change to the labels meant to leave it in an `action: merge` state?
> > 
> > <img alt="image" width="747" height="63" src="https://private-user-images.githubusercontent.com/22065329/551720991-358df42d-f148-4286-a4a9-0437192e581f.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzE0NDEyMzgsIm5iZiI6MTc3MTQ0MDkzOCwicGF0aCI6Ii8yMjA2NTMyOS81NTE3MjA5OTEtMzU4ZGY0MmQtZjE0OC00Mjg2LWE0YTktMDQzNzE5MmU1ODFmLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNjAyMTglMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwMjE4VDE4NTUzOFomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWQ1NGFmMTcxNzk3ZmJlOTYzNzA2Y2I4MGY4MDdhOGQ2NWFkYmM2YWRlZjA3YzRjOGZhMDQ3Y2M3Y2Y4NzI2YWEmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.7llf6mPqtka1ApvG4EsreHwrsw2M665UEjSBZCCNtyY">
> 
> @mattrbeck I noticed the CI wasn't passing just yet, so I reverted the label I added. I think that's what that was supposed to represent 😅

### @bencodezen — 0 reactions  
`—`  ·  [link](https://github.com/angular/angular/pull/66655#issuecomment-3786988049)

> @leonsenft FYI. It looks like the auto-formatter in the commit hook is adding the semi-colon to the non-full JavaScript statements... 💀

### @leonsenft — 0 reactions  
`—`  ·  [link](https://github.com/angular/angular/pull/66655#issuecomment-3787247579)

> > @leonsenft FYI. It looks like the auto-formatter in the commit hook is adding the semi-colon to the non-full JavaScript statements... 💀
> 
> I think `git commit --no-verify` can be used to disable the auto-formatter.

### @JeanMeche — 0 reactions  
`—`  ·  [link](https://github.com/angular/angular/pull/66655#issuecomment-3787277160)

> Disabling the autoformatter would still fail at the CI level. 
> We can opt-out of prettiers formatting by adding a `// prettier-ignore` directive

### @bencodezen — 0 reactions  
`—`  ·  [link](https://github.com/angular/angular/pull/66655#issuecomment-3806096494)

> I've updated the guide with your suggestions @kirjs! Let me know what you think!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
