# rust-lang/cargo #16131 — Warn when installing with a non-default toolchain

**[View PR on GitHub](https://github.com/rust-lang/cargo/pull/16131)**

| | |
|---|---|
| **Author** | @smoelius |
| **Status** | ✅ merged |
| **Opened** | 2025-10-18 |
| **Repo** | curated review-culture seed |
| **Diff** | +381 / −59 across 2 files |
| **Engagement** | 16 conversation · 102 inline review comments |

## Top review comments (ranked by reactions)

### @smoelius — 2 reactions  
`❤️ 1 · 🚀 1`  ·  [link](https://github.com/rust-lang/cargo/pull/16131#issuecomment-4076296567)

> I just did a couple tests and I am not seeing the warning. I need to look at this more closely.

### @epage — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/rust-lang/cargo/pull/16131#issuecomment-3750596588)

> Thanks for your patience through the rounds of feedback!  This is looking great!

### @epage — 1 reactions  
`👍 1`  ·  [link](https://github.com/rust-lang/cargo/pull/16131#issuecomment-4075676865)

> rustup v1.29 is now out, so I'm assuming we should be good on moving forward with this

### @smoelius — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/rust-lang/cargo/pull/16131#issuecomment-4085804032)

> There was a problem with my test. I think this PR is good to go.
> 
> Here is how I tested this. I put the following `rust-toolchain.toml` file in a directory:
> ```toml
> [toolchain]
> channel = "nightly-2026-02-19"
> ```
> Then I ran `rustup which cargo` and replaced that file with a symlink to a build of cargo in my target directory. Finally, I ran the following command:
> ```
> cargo install addr2line --features=bin --force
> ```
> As expected, I saw the following warning demonstrating that the feature is working:
> ```
> warning: default toolchain implicitly overridden with `nightly-2026-02-19-x86_64-unknown-linux-gnu` by rustup toolchain file
> ```

### @smoelius — 0 reactions  
`—`  ·  [link](https://github.com/rust-lang/cargo/pull/16131#issuecomment-3499858309)

> Just FYI, I know it looks like only some of the comments have been addressed. I am still hoping to get feedback on https://github.com/rust-lang/cargo/pull/16131#discussion_r2453595510 and https://github.com/rust-lang/cargo/pull/16131#discussion_r2446422573.

### @smoelius — 0 reactions  
`—`  ·  [link](https://github.com/rust-lang/cargo/pull/16131#issuecomment-3695065393)

> I resolved comments that I thought I implemented uncontroversially. I hope that was okay.
> 
> EDIT: I also hid a few of my own comments that were old.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
