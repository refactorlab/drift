# sharkdp/bat #3438 — feat: make output pipeable with `-n`, non-auto styles

**[View PR on GitHub](https://github.com/sharkdp/bat/pull/3438)**

| | |
|---|---|
| **Author** | @lmmx |
| **Status** | ✅ merged |
| **Opened** | 2025-10-16 |
| **Repo importance** | ★59,273 · 1,572 forks · score 70,499 |
| **Diff** | +91 / −8 across 6 files |
| **Engagement** | 16 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @lmmx — 1 reactions  
`👍 1`  ·  [link](https://github.com/sharkdp/bat/pull/3438#issuecomment-3411022728)

> I've disabled these two tests on Windows as they are failing the CI (snapshots have one fewer terminal width char?) on 2 of the 3 Windows architectures (so if I changed it to per platform it would still not work) :man_facepalming: 
> 
> ```
> failures:
>     piped_output_with_default_style_flag
>     piped_output_with_line_numbers_with_header_grid_style_flag
> ```
> 
> - Log https://github.com/sharkdp/bat/actions/runs/18563295925/job/52917493767?pr=3438
> - :red_circle: [i686-pc-windows-msvc (windows-2025)](https://github.com/sharkdp/bat/actions/runs/18563295925/job/52917493767?pr=3438#logs)
> - :red_circle: x86_64-pc-windows-msvc (windows-2025)
> - :green_circle: aarch64-pc-windows-msvc (windows-11-arm)
> 
> <details><summary>Click to show full log</summary>
> 
> ```
> 
> failures:
> 
> ---- piped_output_with_default_style_flag stdout ----
> 
> thread 'piped_output_with_default_style_flag' panicked at /rustc/1159e78c4747b02ef996e55082b704c09b970588\library\core\src\ops\function.rs:253:5:
> Unexpected stdout, failed diff original var
> ├── original: ─────┬──────────────────────────────────────────────────────────────────────────
> │        │ STDIN
> │   ─────┼──────────────────────────────────────────────────────────────────────────
> │      1 │ hello
> │      2 │ world
> │   ─────┴──────────────────────────────────────────────────────────────────────────
> ├── diff: 
> │   --- 	orig
> │   +++ 	var
> │   @@ -1 +1 @@
> │   -─────┬──────────────────────────────────────────────────────────────────────────
> │   +─────┬─────────────────────────────────────────────────────────────────────────
> │   @@ -3 +3 @@
> │   -─────┼────────────────────────── … *[truncated]*

### @lmmx — 1 reactions  
`👍 1`  ·  [link](https://github.com/sharkdp/bat/pull/3438#issuecomment-3414510500)

> Ah I hadn’t seen those man page sections before.
> 
> > It makes bat's behavior more complex.
> 
> I'd say it changes the behaviour rather than making it more complex.
> 
> > The rule is no longer "always act like cat when piped."
> 
> Yes, that's exactly the point - this was the requested change in #2935 (agreed to be worked on in 2024, did not land in #2983).
> 
> > Instead, it becomes: "act like cat when piped, unless you use --number (which makes it behave like cat -n) or explicitly set a --style that isn't plain or auto."
> 
> I think this phrasing is unnecessarily verbose. The simpler way to describe it is:
> 
> > act like cat when piped, unless you explicitly set a non-`auto` style.
> 
> Two clarifications:
> 
> - There's no need to mention `plain` in the exceptions, piping with plain style looks the same as cat anyway
> - There's no need to single out `--number`, it's just a style alias and is already covered by "explicitly set a style"
> 
> Based on the man page you quoted, I thought this was already the intended functionality: that the auto style adapts to piping, while explicit styles like default or numbers would work regardless.
> 
> > While this is arguably more intuitive, it's a departure from the simple, documented rule.
> 
> To me, intuitive = simple. If someone explicitly requests a style with `-n` or `--style=numbers`, they expect that style when piping.
> 
> I find it undesirable for bat to behave like cat when piped, and my impression from the issue tracker is that others agree.
> 
> I understood from #2935 and the discussion on the previous PR that this behavior change was desired. If there's still disagreeme … *[truncated]*

### @lmmx — 1 reactions  
`🚀 1`  ·  [link](https://github.com/sharkdp/bat/pull/3438#issuecomment-3414704919)

> - [x] Man page amended accordingly
> 
> I then looked for other docs with the same substring to edit likewise
> 
> ```sh
> louis 🌟 ~/dev/bat $ rg -l 'Specify when to use the dec'
> src/bin/bat/clap_app.rs
> assets/manual/bat.1.in
> doc/long-help.txt
> tests/syntax-tests/highlighted/Manpage/bat-0.16.man
> tests/syntax-tests/source/Manpage/bat-0.16.man
> ```
> 
> - [x] Other docs reviewed:
>   - [x] `src/bin/bat/clap_app.rs` amended to produce the same as `docs/long-help.txt`
>   - [x] `docs/long-help.txt` amended to match the man page
>   - [x] tests/syntax-tests/highlighted/Manpage/bat-0.16.man - man pages for published version 0.16, left as is
>   - [x] tests/syntax-tests/source/Manpage/bat-0.16.man - man pages for published version 0.16, left as is
> 
> - [x] Docs tests are passing again
> 
> The README also mentions cat-like behaviour in two places ([file concatenation](https://github.com/sharkdp/bat/blob/a730eaae0a17de2c2fd8099471a49e7419db1b54/README.md?plain=1#L69-L72) and [xclip](https://github.com/sharkdp/bat/blob/a730eaae0a17de2c2fd8099471a49e7419db1b54/README.md?plain=1#L188-L196) examples), but I'd leave these as is since they still work as shown. The modifier "except if a style is set" could be added, but I think this is sufficiently intuitive/already documented that it would be unnecessary.
> 
> :+1: Ready for re-review, taking back out of draft

### @keith-hall — 1 reactions  
`👍 1`  ·  [link](https://github.com/sharkdp/bat/pull/3438#issuecomment-3423130787)

> Just an FYI, apparently some workflows (aliasing `cat` with specific arguments) have been disrupted due to this change: https://github.com/sharkdp/bat/issues/3445
> Maybe you can help think of the best way forward please @lmmx. Ideally we want to make everyone happy :sweat_smile:

### @lmmx — 1 reactions  
`👍 1`  ·  [link](https://github.com/sharkdp/bat/pull/3438#issuecomment-3423208491)

> Sorry @keith-hall I was reviewing bug reports in here this morning and did not spot this 🤦‍♂️ Taking a look now

### @keith-hall — 1 reactions  
`👍 1`  ·  [link](https://github.com/sharkdp/bat/pull/3438#issuecomment-3423494907)

> > That issue seems to be addressed already, not sure what the ask is here @keith-hall but happy to think about any further accomodations. Were there any other reports or just this one so far?
> 
> Just this one so far that I have seen. I guess I just want us to be prepared in case more come in. I completely agree about aliasing `cat` 😉 but as it is mentioned in the Readme, we kinda have to support it and try to behave in a way that doesn't break too much...
> 
> I was wondering whether it would be safer to only fix `-n` specifically when it is on the command line (ignoring env vars and config) and in other cases, update the documentation to refer to `--decorations`. But that also complicates things from a user's perspective - having some arguments work differently when on the command line would be highly unintuitive. So I don't really like that solution 😅 
> 
> Probably we can leave things as they are for now. Thanks for checking common usage 👍


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
