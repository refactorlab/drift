# bitcoin/bitcoin #30595 — kernel: Introduce C header API

**[View PR on GitHub](https://github.com/bitcoin/bitcoin/pull/30595)**

| | |
|---|---|
| **Author** | @sedited |
| **Status** | ✅ merged |
| **Opened** | 2024-08-06 |
| **Diff** | +5,419 / −273 across 19 files |
| **Engagement** | 144 conversation comments · 313 inline review comments |

## Why this PR is notable

Introducing a C header API to the Bitcoin kernel. `Davidson-Souza` reports **empirical results from actually running the API** for the benefit of other reviewers; `josibake` decodes the maintainer's signal as *'Concept ACK, Approach NACK.'*

## 🧠 The lesson for reviewers

> In rigorous review cultures, reviewers **test the branch and report back**, and they read intent precisely — separating agreement on the *idea* from objection to the *approach*.

## How the author framed it (PR description excerpt)

> This is a first attempt at introducing a C header for the libbitcoinkernel library that may be used by external applications for interfacing with Bitcoin Core's validation logic. It currently is limited to operations on blocks. This is a conscious choice, since it already offers a lot of powerful functionality, but sits just on the cusp of still being reviewable scope-wise while giving some pointers on how the rest of the API could look like.
> 
> The current design was informed by the development of some tools using the C header:
> 
> * A re-implementation (part of this pull request) of [bitcoin-chainstate](https://github.com/bitcoin/bitcoin/blob/master/src/bitcoin-chainstate.cpp).
> * A re-implementation of the python [block linearize](https://github.com/bitcoin/bitcoin/tree/master/contrib/linearize) scripts: https://github.com/TheCharlatan/bitcoin/tree/kernelLinearize 
> * A silent payment scanner: https://github.com/josibake/silent-payments-scanner
> * An electrs index builder: https://github.com/josibake/electrs/commits/electrs-kernel-integration
> * A rust bitcoin node: https://github.com/TheCharlatan/kernel-node
> * A reindexer: https://github.com/TheCharlatan/bitcoin/tree/kernelApi_Reindexer
> 
> The library has also been used by other developers already:
> 
> * A historical block analysis tool: https://github.com/ismaelsadeeq/mining-analysis
> * A swiftsync hints generator: https://github.com/theStack/swiftsync-hints-gen
> * Fast script validation in floresta: https://github.com/vinteumorg/Floresta/pull/456
> * A swiftsync node implementation: https://github.com/2140-dev/swiftsync/tree/master/node
> 
> Next to the C++ header also made available in this pull request, bindings for other languages are …​ *[truncated]*

## Highest-signal comments (ranked by reactions)
> ⚠️ Only the first 100 conversation comments were fetched (API page limit); a later comment could out-rank these.


### @Davidson-Souza — 11 reactions  
`❤️ 11`  ·  [link](https://github.com/bitcoin/bitcoin/pull/30595#issuecomment-2855208506)

> I've tried out some of the code, specifically the API for validating transactions. I'm reporting back some of the results I've got so far, hopefully this info is useful for reviewers.
> 
> As some of you might know, I have a [project](https://github.com/vinteumorg/floresta) that uses the now deprecated (see #29189) `libbitcoinconsensus` for script validation. This is a nice feature, since script is usually the hardest part to re-implement when it comes to Bitcoin consensus. However, apart from being deprecated, `libbitcoinconsensus` had a huge performance bottleneck: it deserialized transactions every time we called it. And since the expose `verify_script` function was called per input, a `tx` with several inputs would cause the same `tx` to be deserialized several times. To make things worse, Bitcoin Core appears to have an optimization for `CTransaction`, where it pre-computes the `txid` and `wtxid` when the tx is deserialized. I believe this is due to those values being used all the time, wouldn't make sense to keep recomputing it. But for this case, it meant that we would recompute the `txid` and `wtxid` of the same transaction, for every input.
> 
> When profiling `Floresta`, I've realized that after our `assumevalid` height (in this context `assumevalid` is the same concept as core's), we would take about 40% of CPU time computing those hashes, as shown in this flamegraph.
> 
> ![Image](https://github.com/user-attachments/assets/5f380940-7c4f-495d-ad18-f91572e5d1f4)
> 
> The API introduced in this PR, exposes a opaque type for `CTransaction`, that is then passed as parameter to the `verify` function. So no per-input deserialization, you parse it once and re-use it in all calls for …​ *[truncated]*


### @josibake — 3 reactions  
`👍 3`  ·  [link](https://github.com/bitcoin/bitcoin/pull/30595#issuecomment-3069964449)

> > > am not sure how I am to interpret your NACK here.
> > 
> > Just as "I think this PR should not be merged in its current form." I definitely do agree with the approach of adding a C API.
> 
> FWIW, I read this as "Concept ACK, Approach NACK" (per https://github.com/bitcoin/bitcoin/blob/master/CONTRIBUTING.md#conceptual-review), which I think is a helpful distinction.


### @sedited — 2 reactions  
`👍 2`  ·  [link](https://github.com/bitcoin/bitcoin/pull/30595#issuecomment-2285719575)

> Thank you for the questions and kicking this discussion off @ryanofsky! I'll update the PR description with a better motiviation re. C vs C++ header, but will also try to answer your questions here.
> 
> > This seems to offer a lot of nice features, but can you explain the tradeoffs of wrapping the C++ interface in C instead of using C++ from rust directly? It seems like having a C middle layer introduces a lot of boilerplate, and I'm wondering if it is really necessary. For example it seems like there is a rust cxx crate (https://docs.rs/cxx/latest/cxx/, https://chatgpt.com/share/dd4dde59-66d6-4486-88a6-2f42144be056) that lets you call C++ directly from Rust and avoid the need for C boilerplate. It looks like https://cppyy.readthedocs.io/en/latest/index.html is an even more full-featured way of calling c++ from python.
> 
> It is true that the interoperability between C++ and Rust has become very good. In fact there is someone working on wrapping the entirety of Bitcoin Core in Rust: https://github.com/klebs6/bitcoin-rs.
> 
> During the last Core Dev meeting in Berlin I also asked if a C API were desirable in the first place ([notes here](https://btctranscripts.com/bitcoin-core-dev-tech/2024-04/kernel/)) during the libbitcoinkernel session. I moved forward with this implementation, because the consensus at the time with many contributors in the room was that it was desirable. The reasons for this as discussed during the session at the meeting can be briefly summarised:
> 
> * Shipping a shared library with a C++ header is hard
> * Mature and well-supported tooling for integrating C exists for nearly every popular language.
> * C offers a reasonably stable ABI
> 
> So if we want the broadest pos …​ *[truncated]*


### @josibake — 2 reactions  
`👍 2`  ·  [link](https://github.com/bitcoin/bitcoin/pull/30595#issuecomment-2325848908)

> Concept ACK
> 
> Also an implicit approach ACK despite not heavily reviewing the code (yet). I have been focusing on using the kernel library in proof of concept applications to get a better sense of how well the library works for downstream users and to hopefully uncover any pain points preemptively. A few of these projects are linked in the PR description.
> 
> Regarding a C header vs C++ header, thanks @ryanofsky for taking the time to explain your thought process. I think you raise some excellent points. I'll try to respond as best I can, despite being slightly out of my depth on this topic 😅 
> 
> ---
> 
> For me, the value of libbitcoinkernel is only fully realised with the broadest possible language support and ease of use for downstream projects. This is why I strongly prefer the C header approach for the following reasons:
> 
> 1. Mature tooling for C language bindings
> 2. Stable ABI
> 3. Well established pattern in other open source projects
> 
> If we agree that broad language support is a goal of libbitcoinkernel, highlighting languages that _do not_ support C++ bindings is a much more compelling argument for a C header than highlighting languages that _do_ support C++ bindings as an argument for a C++ header.
> 
> Regarding some of the mentioned languages/tools which do have C++ language binding support: 
> 
> > Tools like these do not support all C++ types and features, and can make it necessary to selectively wrap more complicated C++ interfaces with simpler C++ interfaces, or even C interfaces
> 
> In this example, who is doing the wrapping to be able to use these tools? If it's us, this seems much more complicated to ship and maintain a mixed wrapper and also feels over engineered to a specifi …​ *[truncated]*


---
*Data pulled live from the GitHub REST API. Reaction counts are a snapshot at fetch time.*
