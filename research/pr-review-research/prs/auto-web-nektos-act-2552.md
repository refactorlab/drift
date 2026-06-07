# nektos/act #2552 — [BREAKING] refactor logger

**[View PR on GitHub](https://github.com/nektos/act/pull/2552)**

| | |
|---|---|
| **Author** | @ChristopherHX |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @SanjulaGanepola
> I tested the changes with the extension and they work. I see we now have `stepResult` for setup and complete job steps. Do you think this PR can contain the other 2 items mentioned in the linked issue

### @ChristopherHX
> Message for skipped steps - Isn't it partially here? you need to use `-v` aka verbose. I would recommend that your extension then filters debug/trace away by default, log level is a json property

### @SanjulaGanepola
> There is a `stepResult` only for the step itself and the `post` stage. `pre` stage for some reason does not have it. In act, it would be best to always have a `stepResult` for every stage

### @ChristopherHX
> moving downloading actions into the setup job step makes more sense for me to align with actions/runner

### @ChristopherHX
> You're not authorized to merge this pull request. I'm currently moving my resources to other projects that are less stale, closed a couple of my PR's here already.

### @SanjulaGanepola
> Could we get this change merged and released?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
