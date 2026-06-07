# tauri-apps/tauri #12668 — feat: introduce `App::run_return`

**[View PR on GitHub](https://github.com/tauri-apps/tauri/pull/12668)**

| | |
|---|---|
| **Author** | @thomaseizinger |
| **Status** | ✅ merged |
| **Opened** | 2025-02-10 |
| **Repo importance** | ★107,509 · 3,672 forks · score 127,195 |
| **Diff** | +155 / −50 across 11 files |
| **Engagement** | 42 conversation · 26 inline review comments |

## Top review comments (ranked by reactions)

### @FabianLars — 2 reactions  
`👍 2`  ·  [link](https://github.com/tauri-apps/tauri/pull/12668#issuecomment-2650841981)

> > Do we want to deprecate run_iteration as part of this?
> 
> imo yes

### @thomaseizinger — 1 reactions  
`👍 1`  ·  [link](https://github.com/tauri-apps/tauri/pull/12668#issuecomment-2719247236)

> In our case, the equivalent of your `close` returns an error for us that I'd like to use to inform the exit code. This is possible but duplicates all error handling because the app can also fail prior to Tauri starting and it would be nice to unify all of that into one fallible function and hence the need for `run_return`.
> 
> I am almost certain we can achieve the same thing with some modifications to the internals of `event_loop.run_return`. It should be possible to run one or a few more ticks of the event-loop after receiving the exit event.

### @thomaseizinger — 0 reactions  
`—`  ·  [link](https://github.com/tauri-apps/tauri/pull/12668#issuecomment-2649949902)

> Do we want to deprecate `run_iteration` as part of this?

### @FabianLars — 0 reactions  
`—`  ·  [link](https://github.com/tauri-apps/tauri/pull/12668#issuecomment-2650847770)

> iirc run_return also works on android (though probably good to test that first), only iOS should be a problem. I'm wondering whether we should really go for the cfg flag you used or just try to do what winit for example does and just document that it doesn't return ever on iOS (using tao's run instead of run_return for iOS internally). didn't look too much into the code yet so idk how feasible that is.

### @thomaseizinger — 0 reactions  
`—`  ·  [link](https://github.com/tauri-apps/tauri/pull/12668#issuecomment-2653417589)

> > iirc run_return also works on android (though probably good to test that first), only iOS should be a problem. I'm wondering whether we should really go for the cfg flag you used or just try to do what winit for example does and just document that it doesn't return ever on iOS (using tao's run instead of run_return for iOS internally). didn't look too much into the code yet so idk how feasible that is.
> 
> Removing the cfg is a semver-compatible change so we can always do that later? I'd prefer an incremental approach if possible! :)
> 
> `run_iteration` is only exposed on desktop hence why I copied that. (To me, adding `run_return` is a bugfix for `run_iteration`).
> 
> Deciding on what the mobile story is here seems like a different problem to me that I'd rather not tackle, also because I don't know the internals of tao and Tauri well enough :)

### @thomaseizinger — 0 reactions  
`—`  ·  [link](https://github.com/tauri-apps/tauri/pull/12668#issuecomment-2655175671)

> @FabianLars 
> 
> - `App::run_iteration` has been deprecated.
> - I had to re-introduce an actual implementation of `Wry::run` because `run_return` in tao is not available on iOS and Android. To deduplicate the code, I extracted a factory fn for the event handler.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
