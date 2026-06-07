# rust-lang/cargo #14615 — Add terminal integration via ANSI OSC 9;4 sequences

**[View PR on GitHub](https://github.com/rust-lang/cargo/pull/14615)**

| | |
|---|---|
| **Author** | @Gordon01 |
| **Status** | ✅ merged |
| **Opened** | 2024-09-29 |
| **Repo** | curated review-culture seed |
| **Diff** | +225 / −17 across 5 files |
| **Engagement** | 31 conversation · 94 inline review comments |

## Top review comments (ranked by reactions)

### @Gordon01 — 9 reactions  
`❤️ 4 · 🚀 5`  ·  [link](https://github.com/rust-lang/cargo/pull/14615#issuecomment-2525087558)

> Hello, @epage and everyone interested. Hope, you're well!
> 
> I have a good news! The progress in standartisation of the sequence is going well. Soon it's gonna be supported by systemd and GNOME vte. Here is the [message](https://gitlab.gnome.org/GNOME/vte/-/issues/2845#note_2289317) from [Christian Persch](https://gitlab.gnome.org/chpe):
> > So my conclusion after reading through this issue, the windows terminal issue/pr, and conemu implementation, is that while this API has flaws and might be improved, it's reasonably widely implemented, and small enough (and the flaws small enough) so as to make it not worthwhile to try to invent yet another protocol for this.
> Therefore I'm going to commit a patch to support `OSC 9 ; 4` to vte (plus hook it up in the test app). I've changed it a bit since the last wip/progress branch; please check and test if this still meets the requirements. The parser at least should fully copy conemu behaviour.
> 
> And, cosequently [support to Ptyxis was added](https://blogs.gnome.org/chergert/2024/12/03/ptyxis-progress-support/).
> 
> From [Lennart Poettering](https://mastodon.social/@pid_eins/113406672373007116):
> >Since a while systemd has been showing nice terminal progress bars when doing certain slow operations (for example, when systemd-repart initializes a disk). With v257 [we go one step further with this](https://github.com/systemd/systemd/pull/34929). Whenever we show the progress bar we'll now also issue certain terminal ANSI sequences that tell your terminal emulator that a slow operation is going on and what the progress currently is.
> 
> And the bug i … *[truncated]*

### @Gordon01 — 5 reactions  
`🚀 5`  ·  [link](https://github.com/rust-lang/cargo/pull/14615#issuecomment-2567087040)

> Happy New Year and Merry Christmas!
> 
> I had a lot of work in the last weeks of December and now I'm on New Year vacation. I'll be back in the second half of January, I'll fix the tests, decide on naming. 
> 
> Wishing everyone a happy new 2025!

### @wez — 4 reactions  
`👍 3 · ❤️ 1`  ·  [link](https://github.com/rust-lang/cargo/pull/14615#issuecomment-2646738819)

> Just wanted to chime in here to say that WezTerm just now added support for these escapes in `main`.
> It should be fine to emit the escapes in earlier versions, but in case you prefer to probe to be sure, you can look for the following environment variables:
> 
> ```
> TERM_PROGRAM=WezTerm
> TERM_PROGRAM_VERSION=20250209-182623-44866cc1
> ```
> 
> `$TERM_PROGRAM_VERSION` will be `20250209-182623-44866cc1` or greater in wezterms that support this sequence.
> 
> https://github.com/wezterm/wezterm/issues/6581 is the wezterm issue tracking this feature.

### @Gordon01 — 3 reactions  
`👍 2 · ❤️ 1`  ·  [link](https://github.com/rust-lang/cargo/pull/14615#issuecomment-2649307423)

> Hi everyone!
> 
> I've changed the feature name to progress report. This name keeps the focus on what the feature does (reporting progress) rather than how it’s rendered.
> 
> I've also added WizTerm detection.
> 
> @wez also called is like this.
> 
> I can't make test to work. It passes locally on Windows and Linux but here on pipeline it behaves differently and I can't figure out why.

### @epage — 3 reactions  
`❤️ 1 · 🚀 2`  ·  [link](https://github.com/rust-lang/cargo/pull/14615#issuecomment-2710849640)

> With the cargo team having had several months to give input, this has been discussed multiple times in meetings, and all check boxes are marked, I figure we don't need to wait for the full 10 day waiting period.  That can help with getting wider input which is more important for more wide impacting changes than things like this which is more niche.
> 
> We also don't have to wait until every terminal is supported but future PRs can handle those.

### @epage — 3 reactions  
`👍 3`  ·  [link](https://github.com/rust-lang/cargo/pull/14615#issuecomment-2835491637)

> > I would also love to break this feature out into a separate crate for reusability in other projects.
> Can I create a new crate within Cargo’s workspace, following [these contribution guidelines](https://doc.crates.io/contrib/implementation/packages.html)?
> 
> There is a high bar for crates to be opened by Cargo.  I'd be fine having such a crate in the [rust-cli org](https://github.com/orgs/rust-cli/repositories?type=all).  I've been trying to decide whether it'd be appropriate to have in [anstyle repo](https://github.com/rust-cli/anstyle) or not (along with hyperlink helpers)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
