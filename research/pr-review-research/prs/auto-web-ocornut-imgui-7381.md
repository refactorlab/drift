# ocornut/imgui #7381 — Backends: SDL3: Fix leak of SDL_GetGamepads() return value

**[View PR on GitHub](https://github.com/ocornut/imgui/pull/7381)**

| | |
|---|---|
| **Author** | @edmonds |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ocornut
> That seems correct. `SDL_free()` can accept a nullptr, so could you edit the PR to remove the if block?

*(Note: this small bug-fix PR contained limited discussion; the comment above was the only substantive technical review thread on the page. The reviewer pointed out that the original null check before freeing memory was unnecessary because SDL's free function safely handles null pointers, allowing simpler code.)*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
