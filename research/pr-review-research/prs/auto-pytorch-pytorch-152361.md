# pytorch/pytorch #152361 — Build libgomp (gcc-13) from src on AArch64

**[View PR on GitHub](https://github.com/pytorch/pytorch/pull/152361)**

| | |
|---|---|
| **Author** | @fadara01 |
| **Status** | ✅ merged |
| **Opened** | 2025-04-28 |
| **Repo** | curated review-culture seed |
| **Diff** | +60 / −0 across 2 files |
| **Engagement** | 34 conversation · 10 inline review comments |

## Top review comments (ranked by reactions)

### @fadara01 — 1 reactions  
`👍 1`  ·  [link](https://github.com/pytorch/pytorch/pull/152361#issuecomment-2836451267)

> @pytorchbot label "ciflow/linux-aarch64"

### @fadara01 — 1 reactions  
`👀 1`  ·  [link](https://github.com/pytorch/pytorch/pull/152361#issuecomment-2991836157)

> Hi @malfet - it would be great to get your feedback/insights for this change. 
> #155795 contains context about the problem it aims to solve.

### @nikhil-arm — 1 reactions  
`👍 1`  ·  [link](https://github.com/pytorch/pytorch/pull/152361#issuecomment-3462795803)

> @pytorchbot cherry-pick --onto="main" -c=regression

### @nikhil-arm — 1 reactions  
`👍 1`  ·  [link](https://github.com/pytorch/pytorch/pull/152361#issuecomment-3462830876)

> @pytorchbot revert -m="wrongbranch" -c=weird

### @jondea — 0 reactions  
`—`  ·  [link](https://github.com/pytorch/pytorch/pull/152361#issuecomment-2837662203)

> It generally looks good to me, I just have a few questions. What's the motivation for this? Also, it would be great to motivate the build/link flags with some comments. Did you get them from somewhere else? If so it would be worth a link so that we can keep them updated.

### @fadara01 — 0 reactions  
`—`  ·  [link](https://github.com/pytorch/pytorch/pull/152361#issuecomment-3088676078)

> >We should not be in business of building basic OS components, like compiler, OpenMP runtime, etc, but rather rely on system vendors to provide them
> 
> I agree, with you on this, I only did this because I couldn't find any other option.
> 
> >I.e. it would be good to make similar change upstream against https://github.com/pypa/manylinux (unless it's already there for later versions)
> 
> Yeah, later versions - i.e. manylinux 2.34 (AlmaLinux 9) has a newer version of libgomp which yields the same gains as the one we're updating to, but I assume PyTorch are not ready to move to that version yet because it won't be compatible with Ubuntu versions <  21.10.
> 
> >Something tells me there probably already a binary copy available inside /opt/rh/gcc-toolset-${GCCTOOLSET_VERSION}/root/usr/lib64
> 
> Yeah that was my impression too, but there's only a `libgomp.so` under `/opt/rh/gcc-toolset-11/root/usr/lib/gcc/aarch64-redhat-linux/11` which is linker script pointing to the libgomp in `/usr/lib64/libgomp.so.1`. 
> If you uninstall libgomp and then try to install `gcc-toolset-11-gcc`, that will also install libgomp 8.5 since it's listed as a dependency for `gcc-toolset-11-gcc` indicating it's not part of that package.
> ```
> [root@685358f9c0ad 11]# dnf install gcc-toolset-11-gcc
> Last metadata expiration check: 18:51:04 ago on Thu 17 Jul 2025 01:51:09 PM UTC.
> Dependencies resolved.
> =================================================================================================================================================
>  Package                               Architecture               Version … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
