# Homebrew/brew #16594 — feat: add generated SPDX file on bottling

**[View PR on GitHub](https://github.com/Homebrew/brew/pull/16594)**

| | |
|---|---|
| **Author** | @SMillerDev |
| **Status** | ✅ merged |
| **Opened** | 2024-02-05 |
| **Repo importance** | ★48,317 · 11,150 forks · score 97,901 |
| **Diff** | +446 / −1 across 4 files |
| **Engagement** | 22 conversation · 53 inline review comments |

## Top review comments (ranked by reactions)

### @MikeMcQuaid — 2 reactions  
`👍 1 · 👀 1`  ·  [link](https://github.com/Homebrew/brew/pull/16594#issuecomment-2017471625)

> > Didn't know we had that, it sounds awesome.
> 
> It is good for catching problems for sure.
> 
> > Do we use that for the API already?
> 
> No(t yet). We'd need to create and publish a schema, too. Might want to sync up with @apainintheneck and save this for API v3 rather than create a v2 schema that won't be around in a year.

### @Bo98 — 1 reactions  
`👍 1`  ·  [link](https://github.com/Homebrew/brew/pull/16594#issuecomment-2077560932)

> We cannot vendor it for all as it unfortunately depends on a native extension (via `simpleidn` -> `unf` -> `unf_ext`).
> 
> We already have `rexml` in multiple groups so it isn't really a problem having it in potentially many groups.

### @SMillerDev — 0 reactions  
`—`  ·  [link](https://github.com/Homebrew/brew/pull/16594#issuecomment-1930019797)

> > feels a bit weird this living on Tab when it's got little in common there
> 
> Yeah, I was considering splitting it out of tab, but it is sort of the same thing so wanted to get it public first.
> 
> > do we have requests for these files anywhere you can link to?
> 
> No, but I can see the tooling being available in the larger ecosystem be useful. And I chatted with some people about this and they seemed interested.
> @gdams for example.

### @MikeMcQuaid — 0 reactions  
`—`  ·  [link](https://github.com/Homebrew/brew/pull/16594#issuecomment-1938744113)

> > Yeah, I was considering splitting it out of tab, but it is sort of the same thing so wanted to get it public first.
> 
> Cool, all good, as long as done before merged 👍🏻 
> 
> > No, but I can see the tooling being available in the larger ecosystem be useful. And I chatted with some people about this and they seemed interested.
> > @gdams for example.
> 
> I think this is the sort of thing I'd like to see some more requests for before we consider integration here.

### @gdams — 0 reactions  
`—`  ·  [link](https://github.com/Homebrew/brew/pull/16594#issuecomment-1939138915)

> Yeah this is certainly something that I see to be useful in homebrew. With the significant pressure companies/projects are being put under to provide SBOMs it would be useful for projects to be able to easily determine the exact set of deps in homebrew formulas.

### @jkowalleck — 0 reactions  
`—`  ·  [link](https://github.com/Homebrew/brew/pull/16594#issuecomment-2016609230)

> > Attached is an example SBOM.
> > [spdx.sbom.json](https://github.com/Homebrew/brew/files/14172706/spdx.sbom.json)
> 
> The resulting data structure seams invalid to the SPDX 2.3 JSON schema. 
> Tested with https://www.jsonschemavalidator.net/ and https://www.liquid-technologies.com/online-json-schema-validator


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
