# openai/openai-python #1853 — fix(asyncify): avoid hanging process under certain conditions

**[View PR on GitHub](https://github.com/openai/openai-python/pull/1853)**

| | |
|---|---|
| **Author** | @spokeydokeys |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @RobertCraigie
> Thanks! I assume getting a test setup for this would be difficult?

### @RobertCraigie
> looks like the test is failing is CI, I'm surprised there isn't any output from the subprocess? 🤔

### @RobertCraigie
> ahhh good catch, looks like it's not in the lock file anymore, you'll need to update it with `rye sync`

### @spokeydokeys
> I used a separate process and made sure that process closed in a timely manner...didn't want to introduce a flaky test if I cut the timeout too tight.

### @spokeydokeys
> This fix enables us to run our automated AI tasks in github workflows and we are holding off on deploying until this is merged.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
