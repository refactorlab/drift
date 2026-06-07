# pmndrs/jotai #3147 — test: migrate to Vitest fake timers, remove @testing-library/user-event, and resolve act warnings

**[View PR on GitHub](https://github.com/pmndrs/jotai/pull/3147)**

| | |
|---|---|
| **Author** | @sukvvon |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dai-shi
> Can we keep this unchanged, and make `vi.advanceTimersByTime(0)` in L1151?

### @dai-shi
> I changed my mind. Let's keep our atom definition as much as possible and leave // FIXME comments throughout this PR

### @dai-shi
> I'm still not sure to understand the difference between fireEvent and userEvent. I feel like I will struggle with it when I write a new test.

### @dai-shi
> This changes the behavior. Can you revert?

### @Wendystraite
> fire-event triggers direct DOM events...user-event uses fire-event under the hood and triggers multiple events...In Jotai's case, it doesn't really matter.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
