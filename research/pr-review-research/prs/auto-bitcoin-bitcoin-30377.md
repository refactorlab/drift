# bitcoin/bitcoin #30377 — refactor: Replace ParseHex with consteval ""_hex literals

**[View PR on GitHub](https://github.com/bitcoin/bitcoin/pull/30377)**

| | |
|---|---|
| **Author** | @hodlinator |
| **Status** | ✅ merged |
| **Opened** | 2024-07-02 |
| **Repo** | curated review-culture seed |
| **Diff** | +482 / −361 across 31 files |
| **Engagement** | 53 conversation · 303 inline review comments |

## Top review comments (ranked by reactions)

### @maflcko — 1 reactions  
`👍 1`  ·  [link](https://github.com/bitcoin/bitcoin/pull/30377#issuecomment-2213171483)

> > Like 3 but implement `SetHex(const char* str)` by calling the `std::string_view` version.
> 
> I don't think `const char*` overloads will need to be provided when `string_view` exists. Seems fine to just have a single `sting_view` function (and call it a fix at the same time).

### @ryanofsky — 1 reactions  
`👍 1`  ·  [link](https://github.com/bitcoin/bitcoin/pull/30377#issuecomment-2214432177)

> Concept ACK, and would be very nice for this to cover ParseHex. If it did, it seems like it would fix the unexpected consensus library dependency on the util library that hebasto reported in https://github.com/bitcoin/bitcoin/pull/29015#issuecomment-2209258843: 
> 
> https://github.com/bitcoin/bitcoin/blob/a83f050dbe1392fc6b1b6c2a140c7346653b40d3/src/pubkey.cpp#L193

### @maflcko — 1 reactions  
`👍 1`  ·  [link](https://github.com/bitcoin/bitcoin/pull/30377#issuecomment-2258339031)

> > I think I don't understand the suggestion to this close PR
> 
> To clarify with "close this pull request and open a fresh one" I meant "close this pull request and open a fresh one with the exact same commits, including a proper motivation and pull request description". The reason being that most of the discussion comments are not related to the code changes in this pull request anymore. A good chunk of the discussion was about `ParseHex` and about a change that has since been split up and merged (https://github.com/bitcoin/bitcoin/pull/30377#issuecomment-2225154172).
> 
> But anything is fine here. My main feedback is to clarify the motivation (pull request description). This will have to be done whether it is re-opened or not. Otherwise, every single reviewer and future reader will have to do it themselves, like in https://github.com/bitcoin/bitcoin/pull/30436#issuecomment-2238241424.
> 
> Also, to clarify:
> 
> * Concept ACK on `consteval uint256`.
> * Concept ACK on `consteval` vector hex parsing. (Looking forward to review a pull request with this)

### @hodlinator — 1 reactions  
`👍 1`  ·  [link](https://github.com/bitcoin/bitcoin/pull/30377#issuecomment-2260179265)

> I'll open a new PR for `uint256{"str"}` only (with a clearer motivation) as suggested and possibly re-use this one for `ParseHex` later, unless I don't make that into it's own PR too.

### @ryanofsky — 1 reactions  
`👍 1`  ·  [link](https://github.com/bitcoin/bitcoin/pull/30377#issuecomment-2291521586)

> > The main change is commit b4b923565b4adaa5e3bcb22a6bc03f1f7ac4cdde "util: Add util::HexLiteral and util::Vec functions". The other commits have only minor changes.
> 
> Design note about b4b923565b4adaa5e3bcb22a6bc03f1f7ac4cdde: I spent hours yesterday trying many ways to implement `VectorFromHex(...)` and `ScriptFromHex(...)` hybrid compile/runtime functions that would be equivalent to `Vec(HexLiteral(...))` and `Script(HexLiteral(...)` in this commit and concluded it was impossible because:
> 
> - In order for these functions to be evaluate `char[]` arguments at compile time, they would need to be `constexpr` or `consteval`, which would make it impossible for them to return `std::vector` and `CScript` objects which are usable at runtime.
> 
> - If the functions could not take `char[]` arguments, they would have to take implicitly converted arguments of an intermediate type like `ConstevalHexLiteral` with consteval constructors. But unfortunately, because of the way function template parameter deduction works in C++, the intermediate type would have to be a non-template class instead of a template class, which would make it it impossible for its size to vary based on the size of the string, so not possible for it to represent arbitrary sized binary data.
> 
> Eventually, I did find it was possible to implement hybrid functions that evaluated arguments at compile time but returned values that could be used at runtime if they were written like `VectorFromHex<"1234">()` instead of `VectorFromHex("1234")`. But at that point I became convinced this was a bad approach and that is just better … *[truncated]*

### @maflcko — 1 reactions  
`👍 1`  ·  [link](https://github.com/bitcoin/bitcoin/pull/30377#issuecomment-2295963942)

> I haven't reviewed the last two commits, because I think the test-only changes offers the least amount of benefits, while being the hardest to review, because the type is changed and thus one has to make sure the call graph is still the same. Also, they seemingly are attracting the most bike-shedding.
> 
> I think it would be better to remember the commit and then just update the called sites to accept `std::byte` (and then use that as an excuse to change the tests one-by-one to use the new HexLiteral function) in a follow-up. Otherwise, the tests will be changed again anyway for that reason (to replace `HexLiteral<uint8_t>` with `HexLiteral`).
> 
> If you decide to keep the last two commits, it would be good to correct the scripted-diff, because I think it is wrong and just happens to work by accident. The replacement is `HexLiteral\1<uint8_t>`, where `\1` refers to the original inner Byte type, for example `<std::byte>`. However `HexLiteral<std::byte><uint8_t>` wouldn't be valid C++ code, when the scripted-diff happens to pick it up in the future.
> 
> review ACK 01e18d94d9577f415748869376988e3f0f59ced0 🕶
> 
> <details><summary>Show signature</summary>
> 
> Signature:
> 
> ```
> untrusted comment: signature from minisign secret key on empty file; verify via: minisign -Vm "${path_to_any_empty_file}" -P RWTRmVTMeKV5noAMqVlsMugDDCyyTSbA3Re5AkUrhvLVln0tSaFWglOw -x "${path_to_this_whole_four_line_signature_blob}"
> RUTRmVTMeKV5npGrKx1nqXCw5zeVHdtdYURB/KlyA/LMFgpNCs+SkW9a8N95d+U4AP1RJMi+krxU1A3Yux4bpwZNLvVBKy0wLgM=
> trusted comment: review ACK 01e18d94d9577f415748869376988e3f0f59ced0 🕶
> UHkELMR2tX1aCqoW34 … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
