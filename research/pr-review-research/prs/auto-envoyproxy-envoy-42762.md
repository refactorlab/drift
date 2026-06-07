# envoyproxy/envoy #42762 — http: add sse_to_metadata filter for stream parsing

**[View PR on GitHub](https://github.com/envoyproxy/envoy/pull/42762)**

| | |
|---|---|
| **Author** | @PeterL328 |
| **Status** | ✅ merged |
| **Opened** | 2025-12-23 |
| **Repo** | curated review-culture seed |
| **Diff** | +2709 / −6 across 23 files |
| **Engagement** | 36 conversation · 132 inline review comments |

## Top review comments (ranked by reactions)

### @JuniorHsu — 1 reactions  
`👍 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/42762#issuecomment-3688898953)

> > Tagging @JuniorHsu and @KBaichoo for review 🙏 Seems we need at least 2 owners and 1 maintainer. Wonder if can add you two?
> 
> happy to help review and be one of the owner :)

### @adisuissa — 1 reactions  
`👍 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/42762#issuecomment-3760909536)

> > @adisuissa Looking for some guidance here please Seems CI is failing due to proto_sync wants to delete api/envoy/extensions/sse_content_parsers/json/v3/* which is the new extension category. Are there some steps required for new extension category that I am missing? seems CI just wants to remove it.
> 
> It's been a while since I've seen this, but the script may require the extension to be referenced (so maybe if the [doc error](https://github.com/envoyproxy/envoy/actions/runs/21062606634/job/60572242273#step:21:559) is fixed, then it will keep it).
> You can also look at other PRs that added similar types, and see if there was something special there.

### @PeterL328 — 1 reactions  
`👍 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/42762#issuecomment-3774459019)

> > wondering if you are willing to split the SSE parser out to another PR, and I will take a look, but up to you.
> 
> @botengyao sure i can do that. I'll move the common/sse part and related tests (unit + fuzzer) to another PR. This PR is getting larger so a smaller one will be better to review anyways 😄

### @PeterL328 — 1 reactions  
`👍 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/42762#issuecomment-3774535343)

> Created SSE parser util PR 
> https://github.com/envoyproxy/envoy/pull/43081 
> cc: @botengyao 
> 
> After SSE parser diff lands, I will remove the related files/changes in this diff.

### @tyxia — 1 reactions  
`🎉 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/42762#issuecomment-3802754806)

> @PeterL328  Thanks for the effort to split SSE parser into  https://github.com/envoyproxy/envoy/pull/43081 and get it in!
> 
> Could you please also split the `JSON Content Parser` into a separate self-contained PR,  in the spirit of [small cls](https://google.github.io/eng-practices/review/developer/small-cls.html)? Besides, I understand this parser is used for SSE content but does this need to be tightly coupled with SEE/SEE_metadata? If not, can this be a general json content parser utility in source/common/json folder

### @tyxia — 1 reactions  
`👍 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/42762#issuecomment-3807948842)

> > I see. I do see value in making this non-sse specific. But hard to say what level of abstracting we need for general-purpose json content parser as right now we don't have concrete second use cases. Right now we plan to have json content parser, later we may have other content parsers for xml, regex etc. These family of parsers I guess if we want to make them general-purpose can just be envoy.content_parsers or maybe even envoy.stateful_content_parsers and not specific to sse nor http. @tyxia and @adisuissa (api reviewer) wdyt? I'll create a separate PR (as discussed to make this PR smaller) for this after we reach some idea of what it will look like.
> 
> I agree there is no concrete use cases at the moment. The reason I raise this is because I wanted to discuss
> (1) what is the best location for this parser. (2) Should we have SSE specific thing in this parser 
> 
> If we envision that this parser can be general-purpose . For (1) we probably could move it to  source/common/json, For 2, for example we don't need to set the DefaultNamespace to `"envoy.filters.http.sse_to_metadata"` in that parser.
> 
> We can discuss (2) in the new PR, we probably want to align on (1) first to avoid unnecessary move of files


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
