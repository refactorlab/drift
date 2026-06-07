# tauri-apps/tauri #14523 — Fix(macos/ios): Add handler for web content process termination (fix #14371)

**[View PR on GitHub](https://github.com/tauri-apps/tauri/pull/14523)**

| | |
|---|---|
| **Author** | @JeffTsang |
| **Status** | ✅ merged |
| **Opened** | 2025-11-23 |
| **Repo importance** | ★107,509 · 3,672 forks · score 127,195 |
| **Diff** | +115 / −0 across 7 files |
| **Engagement** | 30 conversation · 5 inline review comments |

## Top review comments (ranked by reactions)

### @JeffTsang — 2 reactions  
`👀 2`  ·  [link](https://github.com/tauri-apps/tauri/pull/14523#issuecomment-3775999734)

> @FabianLars Now that wry has been updated, would it be possible to take a look at this PR?

### @petersamokhin — 2 reactions  
`👍 2`  ·  [link](https://github.com/tauri-apps/tauri/pull/14523#issuecomment-4352257258)

> I confirm this fixes a very critical issue that I thought was too magical to fix in a stable way.
> You can reproduce it with `pkill -9 -f 'com.apple.WebKit.WebContent'`: before this fix, the window just stays empty, but with this fix it reloads properly. Great job and thanks a lot @JeffTsang @FabianLars!

### @gzlboy — 2 reactions  
`🎉 2`  ·  [link](https://github.com/tauri-apps/tauri/pull/14523#issuecomment-4478308307)

> Thank you so much for your reply. I have tested it on the tauri(2.11.2) and it is fixed!
> 
> > @gzlboy This is already merged and available in 2.11.0.

### @JeffTsang — 1 reactions  
`👍 1`  ·  [link](https://github.com/tauri-apps/tauri/pull/14523#issuecomment-4053574160)

> @velocitysystems I've added a default handler for iOS. It reloads the webview since tauri-runtime-wry doesn't have access to get_app_url.

### @JeffTsang — 1 reactions  
`👍 1`  ·  [link](https://github.com/tauri-apps/tauri/pull/14523#issuecomment-4058553112)

> @velocitysystems I've moved the default handler so that I can use navigate with a verified url. This should be a more reliable fix than reloading.

### @JeffTsang — 1 reactions  
`👍 1`  ·  [link](https://github.com/tauri-apps/tauri/pull/14523#issuecomment-4167596211)

> To recap the discussion so far:
> 
> Regarding tests, there's no reason `on_web_content_process_terminate` needs testing any more than a function like `on_page_load`. If you still insist on testing, it would probably require a refactor of `prepare_pending_webview` that is clearly outside of the scope of this PR.
> 
> Regarding logging, I don't think it would be particularly useful to see that the web content process was terminated in the logs. It just adds more noise that you have to filter out. But this is easily added if you want it.
> 
> Regarding rate limited reloads, if reloading your app causes the web content process to be terminated, there's something seriously wrong with your app. It's doubtful that reloading 3 times every 10 seconds is going to fix this.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
