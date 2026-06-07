# nestjs/nest #14881 — fix(common): introduce magic file type validator to nestjs common

**[View PR on GitHub](https://github.com/nestjs/nest/pull/14881)**

| | |
|---|---|
| **Author** | @Chathula |
| **Status** | ✅ merged |
| **Opened** | 2025-03-31 |
| **Repo importance** | ★75,685 · 8,308 forks · score 113,914 |
| **Diff** | +333 / −958 across 11 files |
| **Engagement** | 20 conversation · 8 inline review comments |

## Top review comments (ranked by reactions)

### @kamilmysliwiec — 1 reactions  
`👍 1`  ·  [link](https://github.com/nestjs/nest/pull/14881#issuecomment-2768465376)

> Instead of introducing a new validator, we should probably just replace the logic of the existing one; otherwise we won't get rid of the vulnerability report

### @coveralls — 0 reactions  
`—`  ·  [link](https://github.com/nestjs/nest/pull/14881#issuecomment-2765961923)

> ## Pull Request Test Coverage Report for [Build c6d89f19-7909-4729-a795-fc3ab4be8c81](https://coveralls.io/builds/73183628)
> 
> ### Details
> 
> * **11** of **11**   **(100.0%)**  changed or added relevant lines in **1** file are covered.
> * No unchanged relevant lines lost coverage.
> * Overall coverage increased (+**0.01%**) to **89.32%**
> 
> ---
> 
> |  Totals | [![Coverage Status](https://coveralls.io/builds/73183628/badge)](https://coveralls.io/builds/73183628) |
> | :-- | --: |
> | Change from base [Build 91c827b1-b77d-4e6b-8884-c81544ad6b65](https://coveralls.io/builds/73143854): |  0.01% |
> | Covered Lines: | 7159 |
> | Relevant Lines: | 8015 |
> 
> ---
> ##### 💛  - [Coveralls](https://coveralls.io)

### @Chathula — 0 reactions  
`—`  ·  [link](https://github.com/nestjs/nest/pull/14881#issuecomment-2769548868)

> @kamilmysliwiec I'm not sure why the test suddenly started failing. it passes on local env 😕

### @kamilmysliwiec — 0 reactions  
`—`  ·  [link](https://github.com/nestjs/nest/pull/14881#issuecomment-2771537371)

> Tests for sample 29 (file upload) are now failing:
> ![image](https://github.com/user-attachments/assets/f23e34d4-c133-4163-9dbd-741181efe246)

### @Chathula — 0 reactions  
`—`  ·  [link](https://github.com/nestjs/nest/pull/14881#issuecomment-2771993958)

> > Tests for sample 29 (file upload) are now failing: ![image](https://private-user-images.githubusercontent.com/23244943/429353786-f23e34d4-c133-4163-9dbd-741181efe246.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NDM1ODM5MzgsIm5iZiI6MTc0MzU4MzYzOCwicGF0aCI6Ii8yMzI0NDk0My80MjkzNTM3ODYtZjIzZTM0ZDQtYzEzMy00MTYzLTlkYmQtNzQxMTgxZWZlMjQ2LnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTA0MDIlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUwNDAyVDA4NDcxOFomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTAwNDA2NTQ3ZTRlNDVjZTRmZTRkOTJmYzNmMWI1MWE1NjI3MmEwMDllMGJhYTg5OTc4NzU5NmQyZTZiYzZjODgmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.zJ4R1CTscC7rkr6qT9XHrFTlCp1hi2WtUp3z5-2ELgo)
> 
> Yes, this needs to be fixed. The code throws this error in the e2e test.
> <img width="1125" alt="image" src="https://github.com/user-attachments/assets/b98e0ec8-06fc-4ffc-b245-b19f5505b84f" />
> 
> Also, unit test fails. it doesn't work on node v22.11 with inline import. It throws error`ERR_PACKAGE_PATH_NOT_EXPORTED`. But works fine with node v22.14

### @kamilmysliwiec — 0 reactions  
`—`  ·  [link](https://github.com/nestjs/nest/pull/14881#issuecomment-2777868565)

> `file-type` is an ESM-only package so in order to remain compatible with older versions of Node we'd have to either:
> a) use a different package
> b) use an older version of this package
> c) load it differently (see "load esm modules in cjs")


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
