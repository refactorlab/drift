# gofiber/fiber #3230 — 🔥 feat: Add Support for Removing Routes

**[View PR on GitHub](https://github.com/gofiber/fiber/pull/3230)**

| | |
|---|---|
| **Author** | @ckoch786 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @gaby
> The method has to be added to the docs under `docs/`. Also mention this new method in the `whats_new.md` file.

### @gaby
> In the root of the repo we have a `Makefile` to ease local development...You can run the tests locally and also the lint tests.

### @ReneWerner87
> _Requested changes — flagged code style/formatting concerns through inline review suggestions. (Verbatim prose for this reviewer's inline comments was not fully retrievable from the public conversation page via web fetch.)_

_(Note: This PR's review thread is heavily weighted toward coderabbitai[bot] and Copilot AI inline comments — e.g. concerns about test coverage for removing non-existent/invalid routes, handler-count underflow in `deleteRoute`, and case-sensitivity in route comparison — which are excluded as bot content per collection rules. The human-maintainer prose above focused on documentation completeness and dev-workflow rather than fundamental design objections.)_

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
