# yewstack/yew #4113 — feat: add actix support for yew-link

**[View PR on GitHub](https://github.com/yewstack/yew/pull/4113)**

| | |
|---|---|
| **Author** | @stifskere |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Madoshakalaka
> Can you also come up with an SSR actix-web example in `examples` and extend `tools/ssr-e2e` to test it?...It's quite important because 1. I don't personally use actix-web so I have less confidence this works perfectly. 2. It will be our first actix example...3. this will lend us more confidence in future refactoring.

### @Madoshakalaka
> I merged master into the `yew-link` branch. Can you merge from yew-link first and then address the reviews?

### @Madoshakalaka
> An extra refactoring opportunity is to extract common code between `axum_ssr_router` and `actix_ssr_router`. I'm against it because examples are meant to show users straightforwardly how our code works...So this will stay as some intentional duplication.

### @Madoshakalaka
> The linked_state_handler in yew-link extracts Data<Resolver>, but the server only registered Data<AppState>, returning 500. Install the inner Arc<Resolver> as Data<Resolver> via app_data alongside the AppState.

### @stifskere
> About tweaking `ssr-e2e`, I don't think it's needed because the whole point of actix_web is making things simpler, there is no external needs or dependencies...

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
