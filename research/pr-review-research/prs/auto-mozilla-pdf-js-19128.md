# mozilla/pdf.js #19128 — [api-minor] Render high-res partial page views when falling back to CSS zoom (bug 1492303)

**[View PR on GitHub](https://github.com/mozilla/pdf.js/pull/19128)**

| | |
|---|---|
| **Author** | @nicolo-ribaudo |
| **Status** | ✅ merged |
| **Opened** | 2024-11-29 |
| **Repo importance** | ★53,401 · 10,625 forks · score 100,897 |
| **Diff** | +1460 / −305 across 15 files |
| **Engagement** | 82 conversation · 85 inline review comments |

## Top review comments (ranked by reactions)

### @Snuffleupagus — 1 reactions  
`👍 1`  ·  [link](https://github.com/mozilla/pdf.js/pull/19128#issuecomment-2554632731)

> Btw, does this PR also fix issue #14193?

### @Snuffleupagus — 1 reactions  
`👍 1`  ·  [link](https://github.com/mozilla/pdf.js/pull/19128#issuecomment-2599639018)

> > Q about the "release blocker" label: is it because the next version is a major, and you want to ship this in a major?
> 
> It's not that we couldn't just land this in any "normal" release, but we sometimes decide to bump the major version number when there's a couple of significant new features.
> Given that this PR fixes longstanding issues w.r.t. rendering quality of large pages, this definitely seems to fit that criteria along with other recent changes such as e.g. the separate JPX wasm-file.
> 
> (The label itself is merely used to avoid accidentally creating a release before everything that should go into it is done.)

### @nicolo-ribaudo — 1 reactions  
`👍 1`  ·  [link](https://github.com/mozilla/pdf.js/pull/19128#issuecomment-2631728592)

> @Snuffleupagus I added a detailed test for the `pagerendered` events, following https://github.com/mozilla/pdf.js/pull/19128#discussion_r1939321725, and that lead me to find a bug in this PR.
> 
> Before this PR, `#hasRestrictedRendering` meant "this view has already been rendered at a restircted scale and zoomed through CSS", while this PR was changing it to mean "this view will need to be scaled through CSS". The effect of this was that, when going from "small" to "very big", we'd just apply the CSS zoom to the small canvas rather than first re-rendering it at the maximum size and _then_ applying CSS zoom.
> 
> The reason the `#hasRestrictedRendering` change happened was because we need to know whether we'll need the detail view or not before that the rendering actually happens.
> 
> The last `fixup!` commit fixes this by splitting it into `#hasRestrictedRendering` (with the old meaning) and `#needsRestrictedRendering` (with the new meaning).

### @Snuffleupagus — 1 reactions  
`👍 1`  ·  [link](https://github.com/mozilla/pdf.js/pull/19128#issuecomment-2639799436)

> Once @calixteman is OK with this, I'll look through the PR one final time.
> 
> ---
> 
> Another small, but probably pointless, optimization would be the following:
> ```diff
> diff --git a/web/app.js b/web/app.js
> index 5dfdbbd0b..08df46093 100644
> --- a/web/app.js
> +++ b/web/app.js
> @@ -2310,7 +2310,7 @@ function onPageRender({ pageNumber }) {
>    }
>  }
> 
> -function onPageRendered({ pageNumber, error }) {
> +function onPageRendered({ pageNumber, isDetailView, error }) {
>    // If the page is still visible when it has finished rendering,
>    // ensure that the page number input loading indicator is hidden.
>    if (pageNumber === this.page) {
> @@ -2318,7 +2318,7 @@ function onPageRendered({ pageNumber, error }) {
>    }
> 
>    // Use the rendered page to set the corresponding thumbnail image.
> -  if (this.pdfSidebar?.visibleView === SidebarView.THUMBS) {
> +  if (!isDetailView && this.pdfSidebar?.visibleView === SidebarView.THUMBS) {
>      const pageView = this.pdfViewer.getPageView(/* index = */ pageNumber - 1);
>      const thumbnailView = this.pdfThumbnailViewer?.getThumbnail(
>        /* index = */ pageNumber - 1
> ```

### @nicolo-ribaudo — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/19128#issuecomment-2532674613)

> After discussing this patch with @calixteman, I updated it to prioritize rendering the full css-zoomed canvas rather than the high-resolution one. This means that, when zooming in, you'll first see the css-zoomed canvas, and _then_ it will be replaced by the high-res one once it's ready. It's a slightly worse experience, however it guarantees that we do not regress in cases where the user starts moving around before that we are done rendering the background canvas (because if only the high-res canvas is there, they'll see just white until when the new high-res canvas is rendered).
> 
> I also changed the logic that decides when to re-render the high-res canvas to not only do it once the user scrolls past its edges, but when the user is _close to_ scrolling past the edges.

### @nicolo-ribaudo — 0 reactions  
`—`  ·  [link](https://github.com/mozilla/pdf.js/pull/19128#issuecomment-2536135204)

> Unfortunately this approach has a problem right now: since the various SVG paths for drawings are inserted inside the `.canvasWrapper`, they are now _behind_ the detail layer and thus not visible. Marking as draft until this is fixed.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
