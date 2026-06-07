# TanStack/router #6866 — feat: add @tanstack/intent AI agent skills for Router and Start

**[View PR on GitHub](https://github.com/TanStack/router/pull/6866)**

| | |
|---|---|
| **Author** | @tannerlinsley |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

*Note: This PR (authored by maintainer @tannerlinsley) was reviewed primarily by the @coderabbitai bot. No human reviewer prose was present in the conversation; the bot's most substantive findings are recorded below verbatim as they constitute the actual review content.*

### @coderabbitai (bot)
> The blank line between these two quoted warnings trips markdownlint MD028 and can make the docs check fail.

### @coderabbitai (bot)
> Line 102 uses `QueryClientProvider` but it's not included in the imports (lines 89-91).

### @coderabbitai (bot)
> This catch block only checks `e.code`. If `@tanstack/intent/intent-library` is present but one of its imports is missing, the shim will print the install hint and exit with a misleading error message.

### @coderabbitai (bot)
> Native `<button>` elements are accessible by default—they're focusable, keyboard-activable, and expose proper semantics to assistive technologies.

### @coderabbitai (bot)
> Line 9 uses 'Virtual Route Configuration' (title case) while Line 15 uses 'virtual-route-config' (hyphenated lowercase).

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
