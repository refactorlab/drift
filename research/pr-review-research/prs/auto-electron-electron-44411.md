# electron/electron #44411 — feat: service worker preload scripts for improved extensions support

**[View PR on GitHub](https://github.com/electron/electron/pull/44411)**

| | |
|---|---|
| **Author** | @samuelmaddock |
| **Status** | ✅ merged |
| **Opened** | 2024-10-26 |
| **Repo importance** | ★121,543 · 17,236 forks · score 195,486 |
| **Diff** | +2103 / −298 across 67 files |
| **Engagement** | 16 conversation · 73 inline review comments |

## Top review comments (ranked by reactions)

### @samuelmaddock — 9 reactions  
`❤️ 9`  ·  [link](https://github.com/electron/electron/pull/44411#issuecomment-2597369392)

> I've split out a few components of this PR to make them more approachable. After they're reviewed and merged, I'll glue them back together here.
> 
> - [x] https://github.com/electron/electron/pull/45230
> - [x] https://github.com/electron/electron/pull/45229
> - [x] https://github.com/electron/electron/pull/45232
> - [x] Rebase

### @samuelmaddock — 8 reactions  
`❤️ 8`  ·  [link](https://github.com/electron/electron/pull/44411#issuecomment-2465980179)

> I've refactored `contextBridge.evaluateInMainWorld` to now accept `{ func: Function, args: any[] }` in c6164aa. This is based on logic from Chrome extension's `chrome.scripting.executeScript`.
> 
> Tests to guarantee return values go through the context bridge reuse the logic from our [webFrame.executeJavaScript world safe test.](https://github.com/electron/electron/blob/6e3a5daf62314d4de541d64a1098b0bb3a37168c/spec/api-web-frame-spec.ts#L13-L27) The internals of `evaluateInMainWorld` are shared with `exposeInMainWorld`.
> 
> cc @MarshallOfSound 
> 
> ##### chrome.scripting.executeScript internals
> - Extension IDL specifies `[serializableFunction]` for Function argument \
>   https://source.chromium.org/chromium/chromium/src/+/main:chrome/common/extensions/api/scripting.idl;l=47-53;drc=f54f71679bfe9b9ef10c785369112fb2d0661750
> - `ArgumentSpec::ParseArgumentToFunction` serializes the function using `v8::Function::FunctionProtoToString` \
>   https://source.chromium.org/chromium/chromium/src/+/main:extensions/renderer/bindings/argument_spec.cc;l=744-764;drc=38412897b24a44461ec89d2167e2110a3793c98c
> - `ScriptingExecuteScriptFunction::Run` constructs the function string and serializes arguments as JSON \
>   https://source.chromium.org/chromium/chromium/src/+/main:chrome/browser/extensions/api/scripting/scripting_api.cc;l=617-641;drc=01ab59ae08a38a361da7dac41e36f387f6600ed5
> 
> ##### contextBridge.evaluateInMainWorld(script) types
> 
> The types are currently using `any`. We'll need to modify our type definition generator to better support adding generics here. Given the API being marked as `Experimental` … *[truncated]*

### @MarshallOfSound — 1 reactions  
`👍 1`  ·  [link](https://github.com/electron/electron/pull/44411#issuecomment-2458184630)

> > I'm not sure I fully understand the footgun argument against JS execution (outside of eval strings)
> 
> Let me clarify my stance
> 
> * Eval of strings === hard no from me on any additional API surface that exposed this capability and we should be working to minimize, deprecate and remove existing instances of this
> * Safe stringification of functions + serialized argument passing  === the acceptable alternative to eval of strings, this is what existing APIs should be ported to
> * Context Bridge capabilities, either exposing / overriding existing objects, deep properties === ideal, we should be doing this and recommending this over the other two alternatives
> 
> To give a path forward given the constraints noted above (thanks for those, gives a clear picture of what is needed)
> * Update the API to take a function and stringify it safely using `FunctionProtoToString()`
> * Add a test to ensure user provided toString methods either on functions or on the function prototype don't affect the evaluation 
> * If possible reuse chrome extension evaluation logic for this (they support functions iirc)
> * Ensure return values and arguments go over the ctx bridge
> 
> Docs for the function thing could be fun, but at least technically that's the way forward IMO

### @samuelmaddock — 1 reactions  
`🎉 1`  ·  [link](https://github.com/electron/electron/pull/44411#issuecomment-2504980708)

> Arguments passed into `contextBridge.executeInMainWorld({ func, args })` are now proxied over the context bridge as of [7200ef9](https://github.com/electron/electron/pull/44411/commits/7200ef9eee2b9e97ef73809f7be8268d40b211fb). Now you can do interesting things like pass in a callback to be invoked cross-worlds. Good suggestion y'all!
> 
> ```js
> const { contextBridge } = require('electron');
> 
> const start = Date.now();
> const onCallback = () => {
>   const elapsed = Date.now() - start;
>   console.log(`invoked callback after ${elapsed}ms`);
> };
> 
> contextBridge.executeInMainWorld({
>   func: (callback) => {
>     setTimeout(callback, 1000);
>   },
>   args: [onCallback]
> });
> ```

### @samuelmaddock — 0 reactions  
`—`  ·  [link](https://github.com/electron/electron/pull/44411#issuecomment-2456056940)

> @MarshallOfSound the goal with `evaluateInMainWorld ` is to provide equivalent functionality to `webFrame.executeJavaScript(code)` ([reference in RFC](https://github.com/electron/rfcs/blob/main/text/0008-preload-realm.md#contextbridge)).
> 
> For my particular use case, I'd like to overwrite extension APIs such as `chrome.action`. Here's a relatively simple example.
> ```js
> const { ipcRenderer, contextBridge } = require('electron');
> 
> // Expose setBadgeText API
> contextBridge.exposeInMainWorld('electron', {
>   setBadgeText: (text) => ipcRenderer.send('action.setBadgeText', text)
> });
> 
> // Overwrite extension API to provide custom functionality
> contextBridge.evaluateInMainWorld(`(function () {
>   chrome.action.setBadgeText = (text) => {
>     electron.setBadgeText(text);
>   };
> }());`);
> ```
> 
> A potential alternative might be to accept functions. This is similar to what's offered by [chrome.scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting#runtime_functions) APIs.
> ```js
> function overrideActionApi () {
>   chrome.action.setBadgeText = (text) => {
>     electron.setBadgeText(text);
>   };
> }
> 
> contextBridge.evaluateInMainWorld({
>   func: overrideActionApi,
>   args: []
> });
> ```
> 
> If this method existing on `contextBridge` is a problem, I'm open to introducing a renderer top-level module `(worker|serviceWorker|preloadRealm).executeJavaScript` instead.

### @MarshallOfSound — 0 reactions  
`—`  ·  [link](https://github.com/electron/electron/pull/44411#issuecomment-2456087390)

> webFrame.executeJavaScript is also a foot gun, it's an API that wouldn't land nowadays and if we could, we'd remove it. I wouldn't use it as an example 
> 
> It sounds like what you want is support for overriding existing APIs from contextBridge which is a thing it supports internally but isn't exposed via API


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
