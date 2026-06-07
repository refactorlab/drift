# louislam/uptime-kuma #4717 — feat: Add SNMP Monitor

**[View PR on GitHub](https://github.com/louislam/uptime-kuma/pull/4717)**

| | |
|---|---|
| **Author** | @mattv8 |
| **Status** | ✅ merged |
| **Opened** | 2024-04-27 |
| **Repo importance** | ★87,667 · 7,957 forks · score 124,494 |
| **Diff** | +364 / −66 across 34 files |
| **Engagement** | 31 conversation · 116 inline review comments |

## Top review comments (ranked by reactions)

### @mattv8 — 4 reactions  
`👍 1 · 🎉 3`  ·  [link](https://github.com/louislam/uptime-kuma/pull/4717#issuecomment-2168850226)

> Just to be absolutely sure this feat is ready to ship from my perspective, I tested many scenarios for both the SNMP and JSON Query monitor types. I tested various edge cases and went through each condition (`==`, `!=`, `<`, `<=`, `>`, `>=`). I evaluated every conceivable SNMP response type available from my device (`OctetString`, `OID`, `TimeTicks`, `Integer`, `Gauge`, `Counter`, `IpAddress`, `Counter64`), and several JSON response types from my server (`object`, `array`, `string`, `integer`, `float` and `bool`). I am pushing one last commit to round up the additional edge cases I discovered, and now these cases seem to be managed gracefully. While I acknowledge my testing is not comprehensive, I feel confident that the feature now handles **most** (if not all) expected scenarios.
> 
> In the spoiler below is a table with most of the scenarios, and how the console displays the UP/DOWN status:
> <details>
> 
> <html xmlns:v="urn:schemas-microsoft-com:vml"
> xmlns:o="urn:schemas-microsoft-com:office:office"
> xmlns:x="urn:schemas-microsoft-com:office:excel"
> xmlns="http://www.w3.org/TR/REC-html40">
> 
> <head>
> 
> <meta name=ProgId content=Excel.Sheet>
> <meta name=Generator content="Microsoft Excel 15">
> <link id=Main-File rel=Main-File
> href="file:///C:/Users/mattv/AppData/Local/Temp/msohtmlclip1/01/clip.htm">
> <link rel=File-List
> href="file:///C:/Users/mattv/AppData/Local/Temp/msohtmlclip1/01/clip_filelist.xml">
> 
> </head>
> 
> <body link="#467886" vlink="#96607D">
> 
> Name | Status | DateTime | Message
> -- | -- | -- | --
> SNMP | Up | 6/14/2024 12:31 | JSON   query passes (comparing 1C4� != 0)
> SNMP | Down | … *[truncated]*

### @mattv8 — 3 reactions  
`🎉 3`  ·  [link](https://github.com/louislam/uptime-kuma/pull/4717#issuecomment-2197135632)

> Hey @chakflying wondering if you'd be willing to take a look at this again?

### @chakflying — 2 reactions  
`👍 2`  ·  [link](https://github.com/louislam/uptime-kuma/pull/4717#issuecomment-2129307564)

> - The idea behind my suggestion of using `json-query` for value comparisons, is that it can provide the maximum freedom for users to process and transform the input data before comparison.
> - If all we are using the library for is running a few preset queries, we are not providing that freedom to the user. Then we may as well have not used the library.
> - However, I also see that there is benefit in being able to set a custom condition/comparison operator other than `==`, since it can simplify the expression in complicated cases. (Basically the idea in #4617)
> 
> My ideal implementation would be like this:
> 
> - We reuse existing database columns `json_path` and `expected_value`, instead of creating new one `snmpControlValue`
> - We name the new column for the comparison operator `json_path_operator` instead of the current `snmp_condition` (as it was in #4617)
> - Optionally, we can default `json_path` to `$.value` for people who do not require any transformation.
> - When the monitor runs its check,
>   - we obtain the value from SNMP as it's currently done: `const value = varbinds[0].value;`
>   - we evaluate this value according to user's inputted `json_path`:
>     ```
>        let expression = jsonata(this.jsonPath);
>        let result = await expression.evaluate(value);
>     ```
>   - We compare `result` with `expected_value` using the user's chosen operator (==, >=, etc)
>   - This comparison produces a true/false result which will determine the monitor status
> 
> This implementation would be maximally compatible with the existing `json-query` monitor, and have the benefit that the user has much m … *[truncated]*

### @mattv8 — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/louislam/uptime-kuma/pull/4717#issuecomment-2134180333)

> Hey @chakflying I appreciate your thoughts on all this! Currently on mobile and on vacation, so forgive this for being brief. I'll jump back into this in a week or so when I'm back in town and solid internet.
> 
> Yes, what you're describing I feel is absolutely workable. I think we need to walk the line between absolute freedom of an open text input for json-queries and the simplicity of the comparison drop down. Let me work through this and see what I can come up with!

### @mattv8 — 2 reactions  
`👍 1 · 🎉 1`  ·  [link](https://github.com/louislam/uptime-kuma/pull/4717#issuecomment-2151046360)

> I realize I've now pushed a lot of change all at once and @CommanderStorm might not like it (understandably 😉), but I've retooled the SNMP monitor to use json-query based logic, and I've also created a new utility function that includes conditionals, and re-worked the HTTP(s) - JSON Query monitor, effectively implementing the desired outcome of #4617. Lemme know what you two think once you've had the chance to take a look. I've tested SNMP with it, I'll create a server with a JSON response and test that as well.
> 
> @qu4cks4lb3r I'd be curious to see if this meets your expectations for the conditionals in the json-query monitor, and perhaps you could help test.

### @mattv8 — 2 reactions  
`🎉 2`  ·  [link](https://github.com/louislam/uptime-kuma/pull/4717#issuecomment-2153656043)

> Had some more time today to dive into this and more thoroughly test my feat against an HTTP(s) Json response. I made a few more commits (with lots of changes) to address the issues I encountered. I'm going to let the code settle for a bit now and hopefully folks will get a chance to review.
> 
> Admittedly I went a little overboard and there's a bit of scope change now from the original SNMP monitor. I hope this is acceptable. I'll remain open-minded and if we want to dial it back, let me know. If we need to break this into two PR's; one addressing #4617 and one adding the SNMP monitor I'm fine with that. As it stands, this PR now combines the two feats.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
