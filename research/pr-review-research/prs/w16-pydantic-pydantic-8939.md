# pydantic/pydantic #8939 — Fix TypeAdapter to respect defer_build

**[View PR on GitHub](https://github.com/pydantic/pydantic/pull/8939)**

| | |
|---|---|
| **Author** | @MarkusSintonen |
| **Status** | ✅ merged (2024-04-28) |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> Justify with production impact, then make the trade-off explicit and opt-in. The author's number (startup 40s→10s, k8s autoscaling restored) flips an initial scope-skeptic, and a 12% benchmark regression is *consciously* accepted.

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@sydney-runkle:**
> my initial thought here was that we weren't planning on adding support for defer_build with TypeAdapter

**@samuelcolvin:**
> if it's helping you a lot and is opt in, I'm 👍

**@MarkusSintonen:**
> currently it takes about 1 minute in production to build the core schemas on startup and it greatly degrades Kubernetes auto scaler from working properly

**@sydney-runkle:**
> I'd love to see that improve again before we release 2.8, but I'm not particularly worried about the magnitude of the change


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
