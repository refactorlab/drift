# dotnet/runtime #123819 — New function pointer APIs

**[View PR on GitHub](https://github.com/dotnet/runtime/pull/123819)**

| | |
|---|---|
| **Author** | @jgh07 |
| **Status** | ✅ merged |
| **Opened** | 2026-01-30 |
| **Repo** | curated review-culture seed |
| **Diff** | +1400 / −37 across 37 files |
| **Engagement** | 14 conversation · 236 inline review comments |

## Top review comments (ranked by reactions)

### @jkotas — 1 reactions  
`👍 1`  ·  [link](https://github.com/dotnet/runtime/pull/123819#issuecomment-3939790903)

> I think the calling conventions specified via the explicit arg should always win. I do not think we should be smart about merging. We can throw an exception for now and see whether it causes issues in practices. We can replace the exception with merging later if it proves to be necessary. So something like:
> 
> If there are modopt calling conventions on the return type, they have to match the (non-built in subset of) calling conventions passed via the explicit arg. If they do not match, throw an exception.
> If there are no modopt calling conventions on the return type and there are calling conventions passed in via the explicit arg, wrap the return type to inject the calling conventions as needed.

### @jgh07 — 0 reactions  
`—`  ·  [link](https://github.com/dotnet/runtime/pull/123819#issuecomment-3837108707)

> Since all methods from the API proposal are implemented now, I am removing the "Draft" marking.
> 
> About the suggestion of changing ``MakeFunctionPointerSignatureType`` to take a non-nullable ``Type`` for the return type, is that an acceptable deviation from the approved API shape or does it need to go through the review board again?

### @jkotas — 0 reactions  
`—`  ·  [link](https://github.com/dotnet/runtime/pull/123819#issuecomment-3837168033)

> > About the suggestion of changing MakeFunctionPointerSignatureType to take a non-nullable Type for the return type, is that an acceptable deviation from the approved API shape
> 
> I think it is acceptable deviation.

### @jgh07 — 0 reactions  
`—`  ·  [link](https://github.com/dotnet/runtime/pull/123819#issuecomment-3865675920)

> I'm in the process of extending the test coverage and have encountered some more edge cases/bugs I am fixing now.
> 
> I am wondering if it would be acceptable to defer Mono support to a later PR and to keep this one focused on CoreCLR for now? This PR (including my in-progress changes) has already reached a nontrivial level of complexity and I think separating Mono/CLR into two PRs would be beneficial to keep the scope manageable, both for development and review.

### @jkotas — 0 reactions  
`—`  ·  [link](https://github.com/dotnet/runtime/pull/123819#issuecomment-3865724295)

> > defer Mono support to a later PR 
> 
> Yes, that's ok

### @jgh07 — 0 reactions  
`—`  ·  [link](https://github.com/dotnet/runtime/pull/123819#issuecomment-3878779434)

> Is the remaining test failure on Mono a bug in the Mono runtime? I haven't looked that deep into it, but this logic in ``ves_icall_RuntimeType_GetCallingConventionFromFunctionPointerInternal`` looks wrong to me:
> ````c
> return GUINT_TO_INT8 (mono_method_signature_has_ext_callconv (m_type_data_get_method_unchecked (type), MONO_EXT_CALLCONV_SUPPRESS_GC_TRANSITION) ? MONO_CALL_UNMANAGED_MD : m_type_data_get_method_unchecked (type)->call_convention);
> ````
> It seems to special case ``SuppressGCTransition`` and only returns ``MONO_CALL_UNMANAGED_MD`` if it is present, even though there are other combinations that should produce it.
> 
> For example, in this signature:
> ````csharp
> delegate* unmanaged[Swift]<delegate* unmanaged[Stdcall, MemberFunction]<short, bool>, string>
> ````
> 
> it simply strips off the ``MemberFunction`` calling convention from the inner function pointer.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
