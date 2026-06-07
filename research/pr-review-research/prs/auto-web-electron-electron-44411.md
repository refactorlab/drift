# electron/electron #44411 — feat: service worker preload scripts for improved extensions support

**[View PR on GitHub](https://github.com/electron/electron/pull/44411)**

| | |
|---|---|
| **Author** | @samuelmaddock |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @MarshallOfSound
> Eval of strings === hard no from me on any additional API surface that exposed this capability and we should be working to minimize, deprecate and remove existing instances of this

### @MarshallOfSound
> Safe stringification of functions + serialized argument passing === the acceptable alternative to eval of strings

### @MarshallOfSound
> the web knows it, chrome knows it, passing strings around to be evalled is just a nightmare. Someones gonna do something silly like `window.foo('${userInput}')`

### @samuelmaddock
> A potential alternative might be to accept functions...This is similar to what's offered by chrome.scripting APIs.

### @samuelmaddock
> I've refactored `contextBridge.evaluateInMainWorld` to now accept `{ func: Function, args: any[] }`...based on logic from Chrome extension's `chrome.scripting.executeScript`

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
