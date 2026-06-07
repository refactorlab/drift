# flutter/flutter #157755 — [web] On the web platform, use an <img> tag to show an image if it can't be accessed with CORS

**[View PR on GitHub](https://github.com/flutter/flutter/pull/157755)**

| | |
|---|---|
| **Author** | @harryterkelsen |
| **Status** | ✅ merged |
| **Opened** | 2024-10-28 |
| **Repo importance** | ★176,771 · 30,472 forks · score 303,659 |
| **Diff** | +1127 / −86 across 11 files |
| **Engagement** | 27 conversation · 277 inline review comments |

## Top review comments (ranked by reactions)

### @jezell — 6 reactions  
`👍 6`  ·  [link](https://github.com/flutter/flutter/pull/157755#issuecomment-2506449355)

> This is a very bad idea. I think this will cause many crashes, perf issues, and much harder to solve problems than turning on cors.

### @yjbanov — 6 reactions  
`👍 6`  ·  [link](https://github.com/flutter/flutter/pull/157755#issuecomment-2512355619)

> @jezell 
> 
> We initially wanted to do a separate widget (`WebImage`), so that it's clear that you are using a single origin aware widget, that not all features are available (e.g. you cannot read and process image file bytes or pixels), and you have to opt into using it. This way you would not accidentally step onto footguns, such as multiplying platform views in the app.
> 
> In the end, we decided to go with the approach of enabling CORS in `Image.network` directly. The benefit there is that the API is familiar and backwards-compatible. Importantly, platform views have seen some significant optimizations recently (e.g. https://github.com/flutter/engine/pull/54878), making this approach more viable.
> 
> Now, the performance concern continues to be real, so I think we should look into possible solutions. A few ideas:
> 
> - `Image.network` does not automatically enable cross-origin images, but has a parameter (e.g. `enableCors`) that's `false` by default.
> - Add tooling that would watch cross-origin image usage and report performance cliffs, e.g. when multiple images cause multiple canvas overlays.
> - See if we can use Canvas 2D as a target surface (instead of WebGL or `bitmaprenderer`). This would allow us to draw cross-origin images into the canvas directly without having to split it. We'd probably need to introduce a new kind of platform view (let's call it "drawable platform view"). Such platform views could be drawn into the canvas, but they would (necessarily) taint it (which is nothing new; that's what happens in normal HTML, including Flutter Web's HTML renderer).

### @gochev — 3 reactions  
`👍 2 · 👎 1`  ·  [link](https://github.com/flutter/flutter/pull/157755#issuecomment-2506717496)

> I believe there will always be two camps of people.
> 
> Camp 1 wanting to just work even if it fallbacks to img tag even with worse performance since they wont care and can ship it and then its the client issue.
> 
> Camp 2  who prefer to not work, have a big cors error and they can figure out a solution, download the files on their own, have a proxy server or use another location that has a proper cors or at least dont have cors for get requests since this is dumb anyway.
> 
> Now making any decision to fulfil any of the two camps will make the other people unhappy, so I believe the fallback should either be behind a flag OR there should be a huge big “Warning” printed each time the fallback happens.

### @Levi-Lesches — 3 reactions  
`👍 3`  ·  [link](https://github.com/flutter/flutter/pull/157755#issuecomment-2506730529)

> I think your analysis is correct but your conclusion is not. You're right then some people care more about performance than others, but that does not automatically make it a client issue. Rather, one camp says they are okay with performance while another chooses to work harder to improve it. 
> 
> The problem with cores is that sometimes the only answer is to build a CDN yourself, which can be prohibitively expensive and time consuming to many developers. 
> 
> Making everything Just Work™ by default makes both sides happy: you get a functioning app (which is strictly better than no app), and performance becomes a result of the extra work you put in from there. Some developers will say "good enough" and others will keep going and make a proxy server. At least this way you get a choice between focusing on cors and focusing on other perhaps more important issues

### @iapicca — 3 reactions  
`👍 3`  ·  [link](https://github.com/flutter/flutter/pull/157755#issuecomment-2513608059)

> > * `Image.network` does not automatically enable cross-origin images, but has a parameter (e.g. `enableCors`) that's `false` by default.
> 
> @yjbanov this seems a low hanging fruit, shouldn't this be the case for the current implementation?

### @jezell — 2 reactions  
`👍 2`  ·  [link](https://github.com/flutter/flutter/pull/157755#issuecomment-2508142506)

> @Levi-Lesches I'm not sure Flutter needs in the box support for loading images from sources that have blacklisted cross domain requests in the first place, but the objection here is that making it transparent is killing a gnat with a sledgehammer. Platform views have consistently been a nightmare for us since the day we started using Flutter. As recently as flutter 3.24 they were totally broken even when marked as hidden platform views and would cause your app to go OOM and go into an unrecoverable crash. Transparently forcing that pain on developers in the name of fixing CORS, along with perf issues, braking shaders and filters, screenshot widgets, limitations on the number of platform views breaking the renderer, etc. is not a good plan. Platform views are so problematic that at the very least this should be opt in, since it introduces more problems than it fixes.
> 
> Other alternatives that I can think of to do this without a huge footgun:
> 
> 1) Move this behind something like Image.platform / PlatformImage so it is explicit and you know what you are signing up for. Then document the downsides of using this approach, including that your app might just be totally unstable and crash every few minutes.
> 
> 2) Add a flutter deploy command that can setup CORS headers properly for you on common CDNs. 
> 
> 3) Ship a built in shelf server with flutter, would solve a host of problems like url path routing working properly out of the box, CORS header configuration, and potentially could also serve as a CORS proxy if you really, really need one.
> 
> 4) All of the above


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
