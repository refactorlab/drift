# laurent22/joplin #14820 — Desktop: Resolves #14763: add settings search to config screen (new spec)

**[View PR on GitHub](https://github.com/laurent22/joplin/pull/14820)**

| | |
|---|---|
| **Author** | @slimuCS |
| **Status** | ✅ merged |
| **Opened** | 2026-03-18 |
| **Repo importance** | ★55,101 · 6,143 forks · score 84,668 |
| **Diff** | +834 / −220 across 25 files |
| **Engagement** | 20 conversation · 42 inline review comments |

## Top review comments (ranked by reactions)

### @personalizedrefrigerator — 2 reactions  
`👍 2`  ·  [link](https://github.com/laurent22/joplin/pull/14820#issuecomment-4091551681)

> > I've added a new test that should help auto-detect certain accessibility issues. I'm merging upstream changes into this pull request so that the test runs in CI.
> 
> The accessibility checker has flagged a few potential issues:
> - Contrast issues:
>   - The "Plugins" header has low contrast.
>   - The "Search settings" placeholder has low contrast. (See [WCAG: Contrast minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html#:~:text=applies%20to%20text%20in%20the%20page%2C%20including%20placeholder))
>   - Note: The [WebAIM contrast checker tool](https://webaim.org/resources/contrastchecker/) might be helpful here.
> - ARIA issues:
>    - Elements with [`role="tablist"`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/tablist_role) cannot contain `button`s or `input`s.
>       - Based on the [spec](https://w3c.github.io/aria/#tablist:~:text=composite-,Allowed,tab), `tablist` should only contain elements with the `tab` role.
> 
> <details>
> 
> ```diff
> + Array [
> +   Object {
> +     "description": "Ensure elements with an ARIA role that require child roles contain them",
> +     "help": "Certain ARIA roles must contain particular children",
> +     "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/aria-required-children?application=playwright",
> +     "id": "aria-required-children",
> +     "impact": "critical",
> +     "nodes": Array [
> +       Object {
> +         "all": Array [],
> +         "any": Array [
> +           Object {
> +             "data": Object {
> +               "messageKey": "unallowed",
> +               "values": "input[tabindex], button[aria- … *[truncated]*

### @personalizedrefrigerator — 1 reactions  
`👍 1`  ·  [link](https://github.com/laurent22/joplin/pull/14820#issuecomment-4085664530)

> > Should we treat this as acceptable for this issue, or should we also index screen-internal fields so they can be matched by query?
> 
> For full-screen sections that lack searchable metadata: Unless indexing screen-internal text can be done without significantly increasing the size and complexity of this pull request, I would suggest only searching the section header for now.

### @personalizedrefrigerator — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/laurent22/joplin/pull/14820#issuecomment-4091374936)

> I've added a new test that should help auto-detect certain accessibility issues. I'm merging upstream changes into this pull request so that the test runs in CI.

### @slimuCS — 1 reactions  
`🎉 1`  ·  [link](https://github.com/laurent22/joplin/pull/14820#issuecomment-4092814880)

> > > I've added a new test that should help auto-detect certain accessibility issues. I'm merging upstream changes into this pull request so that the test runs in CI.
> > 
> > The accessibility checker has flagged a few potential issues:
> 
> Hi personalizedrefrigerator, thanks so much for the detailed accessibility feedback!
> 
> I’ve applied the fixes by improving the search placeholder contrast for WCAG readability, removing opacity-based dimming on the Plugins divider to preserve active text contrast, and moving SearchInput outside the tablist while marking the Plugins divider as presentational so tablist semantics remain correct.

### @laurent22 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/laurent22/joplin/pull/14820#issuecomment-4142099359)

> Of the many PR about this issue, this is probably the closest to what we need but again it doesn't build. Please could you confirm you're ok completing this PR?

### @slimuCS — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/laurent22/joplin/pull/14820#issuecomment-4160293534)

> Hi laurent22, very sorry for the late reply, and thank you — I really appreciate the kind words about this PR.
> 
> At the time, I noticed there were quite a few parallel PRs and some of them had solid implementations, so I stepped back a bit and didn’t continue pushing on this one. But I did really value all the feedback and discussions here.
> 
> Recently I also saw that Ehtesham-Zahid has been actively working on this, which is great to see. I’m happy to step aside if their work is moving in the right direction, but I’d also be glad to continue working on this if that’s helpful. Please let me know how you’d like to proceed.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
