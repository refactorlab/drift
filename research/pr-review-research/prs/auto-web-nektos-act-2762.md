# nektos/act #2762 — feat: Add an option to set act executor concurrency by cli option

**[View PR on GitHub](https://github.com/nektos/act/pull/2762)**

| | |
|---|---|
| **Author** | @qoomon |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ChristopherHX
> This kind of concurrency is very broken and the last time making this configurable as it currently is was rejected

### @qoomon
> I'm currently working on an action to run steps in parallel instead of sequential to safe some time and money on steps with a lot of IO like browser tests

### @qoomon
> Because I have to wait for all steps (act jobs) to finish each stage (pre, main, post) I need to run as many act jobs as parallel steps I want to execute

### @qoomon
> BTW I you are interested in a act action, I'm happy to build and contribute the action

### @ChristopherHX
> I think this is good to merge

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
