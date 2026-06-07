# open-webui/open-webui #17223 — feat: Added support for redis as session storage

**[View PR on GitHub](https://github.com/open-webui/open-webui/pull/17223)**

| | |
|---|---|
| **Author** | @cableman |
| **Status** | ✅ merged |
| **Opened** | 2025-09-05 |
| **Repo importance** | ★140,116 · 20,118 forks · score 225,578 |
| **Diff** | +42 / −7 across 2 files |
| **Engagement** | 32 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @tjbck — 1 reactions  
`👍 1`  ·  [link](https://github.com/open-webui/open-webui/pull/17223#issuecomment-3262290890)

> @cableman you most likely don't have `WEBUI_SECRET_KEY` set across all the pods, please confirm.

### @tjbck — 1 reactions  
`👍 1`  ·  [link](https://github.com/open-webui/open-webui/pull/17223#issuecomment-3332082549)

> We'll merge this as-is for now, but further investigation is warranted here. Thanks!

### @Ithanil — 1 reactions  
`👍 1`  ·  [link](https://github.com/open-webui/open-webui/pull/17223#issuecomment-3370901343)

> > @Ithanil, This approach would work and is actually simpler than my suggestion, also it avoid duplicate connection creation and ensuring consistent Sentinel behavior across all Redis operations. However, there's one timing issue to be aware of: the session middleware is added to the app before app.state.redis is initialized in the lifespan function
> > 
> > https://github.com/open-webui/open-webui/blob/3f71fa641ffd3851999cdb3f3a7ea2793f437f45/backend/open_webui/main.py#L559-L563
> > 
> > The middleware setup happens at module load time
> > 
> > https://github.com/open-webui/open-webui/blob/3f71fa641ffd3851999cdb3f3a7ea2793f437f45/backend/open_webui/main.py#L1941-L1946
> > 
> > but app.state.redis isn't created until the lifespan context manager runs at startup (line 559-563).
> > 
> > We would need:
> > 
> >     * Move the middleware setup into the lifespan function after Redis initialization, or
> > 
> >     * Initialize app.state.redis before adding the middleware
> > 
> > 
> > Otherwise, app.state.redis will be None when RedisStore tries to use it
> > 
> > https://github.com/open-webui/open-webui/blob/3f71fa641ffd3851999cdb3f3a7ea2793f437f45/backend/open_webui/main.py#L629
> 
> That's an excellent point, I completely missed that. And Starsession didn't complain about Redis client being None.
> 
> I would propose adding this section to the lifespan function.

### @cableman — 0 reactions  
`—`  ·  [link](https://github.com/open-webui/open-webui/pull/17223#issuecomment-3265045509)

> @tjbck I have set the secret key in my helm values yaml file with all the other configuration values. Also checked that it is presents in the pods `env | grep -i secret`, which it is.

### @tjbck — 0 reactions  
`—`  ·  [link](https://github.com/open-webui/open-webui/pull/17223#issuecomment-3265395138)

> [Our session management is handled **client-side** using **cookies** by default](https://www.starlette.io/responses/#set-cookie), this error does not occur in other multi-pod deployments that we know of. We'll keep this open for now but further investigation is warranted from your end. Keep us updated!

### @cableman — 0 reactions  
`—`  ·  [link](https://github.com/open-webui/open-webui/pull/17223#issuecomment-3266070492)

> Yes, know about the client side cookies and that can results in problems with different browsers and devices. What we see is that the problem goes away, when scaling down to 1 pod.
> 
> It is only a very small (1-2%) of the users that triggers this error, which have made it very hard to debug.
> 
> Will re-post here if we find any more information.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
