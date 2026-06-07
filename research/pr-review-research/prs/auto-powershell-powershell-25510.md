# PowerShell/PowerShell #25510 — Improve verbose and debug logging level messaging in web cmdlets

**[View PR on GitHub](https://github.com/PowerShell/PowerShell/pull/25510)**

| | |
|---|---|
| **Author** | @JustinGrote |
| **Status** | ✅ merged |
| **Opened** | 2025-05-05 |
| **Repo importance** | ★53,793 · 8,334 forks · score 92,085 |
| **Diff** | +258 / −68 across 5 files |
| **Engagement** | 29 conversation · 86 inline review comments |

## Top review comments (ranked by reactions)

### @iSazonov — 1 reactions  
`👍 1`  ·  [link](https://github.com/PowerShell/PowerShell/pull/25510#issuecomment-2856998915)

> Let's wait for what Patrick says. If that PR is not approved, then let's look at switch checks. What I definitely would not like is to create these strings without a condition. 
> We can discuss the details for now.

### @JustinGrote — 1 reactions  
`👍 1`  ·  [link](https://github.com/PowerShell/PowerShell/pull/25510#issuecomment-2860277810)

> @iSazonov thank you for the review, I will incorporate the recently merged PR and your feedback hopefully sometime this week.

### @iSazonov — 1 reactions  
`👀 1`  ·  [link](https://github.com/PowerShell/PowerShell/pull/25510#issuecomment-2873374031)

> > I rebased to latest master and I think that made codefactor mad, you probably need to exclude whatever you did previously for the complex methods.
> 
> Line 1416 `currentRequest.Dispose();`

### @JustinGrote — 1 reactions  
`👍 1`  ·  [link](https://github.com/PowerShell/PowerShell/pull/25510#issuecomment-2955979153)

> > LGTM with one notice: perhaps it makes sense to remove `body` from debug output because it can be too large..
> 
> It is a possibility with text-based responses, but most extremely large responses will be binary that will be summarized.
> 
> I will suggest we merge as is and if feedback shows that it is a constant problem, we either add a fixed or user-configurable truncation option.

### @JustinGrote — 0 reactions  
`—`  ·  [link](https://github.com/PowerShell/PowerShell/pull/25510#issuecomment-2852574973)

> @iSazonov ready to review!
> 
> EDIT: I lied, but now codefactor stuff is fixed.

### @iSazonov — 0 reactions  
`—`  ·  [link](https://github.com/PowerShell/PowerShell/pull/25510#issuecomment-2853330036)

> I wonder how many code you update. 😄 I expect you add only content output.
> 
> I like you create helper methods. But now output is too large and we must generate the output only it is requested.
> I don't find method(s) to check the condition and we could create it here.
> For start see how  `internal void WriteDebug(DebugRecord record, bool overrideInquire = false)` does the check.
> We can get ((MshCommandRuntime)this.CommandRuntime).DebugPreference and reuse code from `internal bool WriteHelper_ShouldWrite`
> (All in src\System.Management.Automation\engine\MshCommandRuntime.cs)
> 
> The same for verbose. But I wouldn't waste time on verbose right now at all. But it's up to you.
> 
> Also I'd prefer to use standard TosString() for request and response. Why do we create custom implementation?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
