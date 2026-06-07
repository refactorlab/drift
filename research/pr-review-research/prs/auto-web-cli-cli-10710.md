# cli/cli #10710 — Introduce accessible prompter for screen readers (preview)

**[View PR on GitHub](https://github.com/cli/cli/pull/10710)**

| | |
|---|---|
| **Author** | @BagToad |
| **Status** | Merged (April 10, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @williammartin
> I think generally we might want to refer to this thing as `screenreaderFriendlyPrompter` rather than `accessiblePrompter`. It's a clearer link to the env var, and accessibility is a big scope.

### @shindere
> I find it a bit discriminating if I have to use another, dedicated way...I would personally like for this prompter...is configurability. Some may want to remove the > sign to gain space.

### @andyfeller
> `huh` validation error message might not be instructive enough for screen readers...versus current experience...X Sorry, your reply was invalid: You entered 150

### @andyfeller
> I don't know if `p.editorCmd` always has a value, which results in the `Open Editor` having no editor listed

### @williammartin
> Approving on the proviso that my comments are addressed as discussed on call...I don't think there is anything to block this PR but we do have more work beyond this.

### @andyfeller
> An astounding heavy lift to get this prompting experience! I think there are things we should follow up...additional UX testing in Linux and Windows, working with our friends at Charm

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
