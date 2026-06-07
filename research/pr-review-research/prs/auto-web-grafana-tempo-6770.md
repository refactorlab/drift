# grafana/tempo #6770 — [DOC] Updates for the skill files; update README for agents

**[View PR on GitHub](https://github.com/grafana/tempo/pull/6770)**

| | |
|---|---|
| **Author** | @knylander-grafana |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @oleg-kozlyuk-grafana
> Guardrails are usually constructs outside the LLM, that don't allow it to 'go off the road'

### @oleg-kozlyuk-grafana
> Generally, I think we can/should just point to modules/generator/AGENTS.md. Info should be local to the context

### @mattdurham
> This does feel really specific. Do we find docs get messed with with metrics generator a lot?

### @mattdurham
> Is this gitignored? I dont see it but this will get busy real quick.

### @Copilot
> The skill header doesn't allow the `Write` tool, but later steps instruct the agent to fix issues in files.

### @Copilot
> Consider adding a `mode` field to each docs-workflow test case...This makes it easier for tooling/readers to reason about the eval set uniformly.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
