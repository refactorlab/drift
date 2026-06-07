# zed-industries/zed #19230 — lsp: Implement support for the `textDocument/diagnostic` command

**[View PR on GitHub](https://github.com/zed-industries/zed/pull/19230)**

| | |
|---|---|
| **Author** | @vitallium |
| **Status** | ✅ merged |
| **Opened** | 2024-10-15 |
| **Repo** | curated review-culture seed |
| **Diff** | +1408 / −124 across 24 files |
| **Engagement** | 19 conversation · 76 inline review comments |

## Top review comments (ranked by reactions)

### @vitallium — 1 reactions  
`👍 1`  ·  [link](https://github.com/zed-industries/zed/pull/19230#issuecomment-2455575004)

> Small update: I am still working on it. I was OOO last week.

### @SomeoneToIgnore — 1 reactions  
`👍 1`  ·  [link](https://github.com/zed-industries/zed/pull/19230#issuecomment-2479007038)

> To respond to the RPC part, it's always so that RPC clients have no access to LSP, it runs on the host machine only (either an RPC owner, or on a headless ssh part).
> 
> So, we always pass the LSP data over the wire and derive the additional properties on the client, hence you can (and should) use existing methods that fill those properties.
> If that's not the case, let's have a look together at some point — ping me when more attention is needed to this PR.

### @vitallium — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/zed-industries/zed/pull/19230#issuecomment-2590913410)

> > Sorry, still crawling towards your PR, which I remember about, but other tasks are always popping.
> 
> No worries! I understand how it goes. There's always a long list of tasks and priorities can shift. I appreciate you keeping my PR in mind. Thanks!

### @vitallium — 1 reactions  
`👍 1`  ·  [link](https://github.com/zed-industries/zed/pull/19230#issuecomment-2605597988)

> > Sorry for taking so long, now I'm back to business and hopefully able to respond to updates more quickly.
> 
> No worries and welcome back! I really appreciate any input you provide here!
> 
> > 
> > Main concerns I have for this PR:
> > 
> > * I want to preserve the existing diagnostics pushes, just in case certain servers are not able to do other things and just in case we mess up this impl, so people can use a fall back.
> >   Also, I think I've raised it in previous reviews, we do not want both modes to work simultaneously?
> >   I see, nothing is removed for pushing handle code, so that's possible?
> >   Given all that, I expected somewhere in the language/language server-related logic, a piece of `if`-based logic to determine which path are we going with.
> 
> My bad, I forgot about that. For some reason, I thought that LSP servers decide which mode to use based on given capabilities, but given how strange LSP servers can sometimes be, having such a switch makes sense. I will add it.
> 
> > * I think, we do not query enough diagnostics, but maybe I'm wrong? Voiced that thought in the `editor.rs` comments.
> 
> Thank you for the thorough review! I will address your points one by one, answering them and composing a TODO list based on your feedback.
> 
> > * We still have some new code added for diagnostics [de]serialization, what was the issue with the existing one that handled pushes via LSP?
> 
> Hi, both functions operate on the `DiagnosticEntry<Anchor>` struct, but pull-based diagnostics have the type `Diagnostic`. The implementation of the `LspCommand` trait for the `GetDocumentDiagnostics` type operat … *[truncated]*

### @vitallium — 0 reactions  
`—`  ·  [link](https://github.com/zed-industries/zed/pull/19230#issuecomment-2414469599)

> Whoops, conflicts. I will resolve them in a bit.

### @vitallium — 0 reactions  
`—`  ·  [link](https://github.com/zed-industries/zed/pull/19230#issuecomment-2414472201)

> > Whoops, conflicts. I will resolve them in a bit.
> 
> Done.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
