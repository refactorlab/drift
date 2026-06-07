# remix-run/react-router #12941 — Add support for client context and middleware (unstable)

**[View PR on GitHub](https://github.com/remix-run/react-router/pull/12941)**

| | |
|---|---|
| **Author** | @brophdawg11 |
| **Status** | ✅ merged |
| **Opened** | 2025-02-03 |
| **Repo** | curated review-culture seed |
| **Diff** | +7944 / −660 across 68 files |
| **Engagement** | 16 conversation · 35 inline review comments |

## Top review comments (ranked by reactions)

### @pawelblaszczyk5 — 2 reactions  
`👍 2`  ·  [link](https://github.com/remix-run/react-router/pull/12941#issuecomment-2692652835)

> I hope it's helpful here, few issues from making branch with the experimental version at my job project:
> 
> 1) `HandleDocumentRequestFunction` is still typed as receiving the old `AppLoadContext` despite getting proper new context provider
> 2) This also impacts the new types and makes the stuff really painful, because `context` isn't `unstable_RouterContextProvider` - https://github.com/remix-run/react-router/issues/12715
> 3) Is there some type that can be used to annotate standalone middleware (outside of route files)? There's `unstable_MiddlewareFunction`, but it forces me to manually pass `unstable_RouterContextProvider` and `Response | void` generics to match the type of middleware inside of route
> 4) Nothing necessary - but it'd be nice if `defaultValue` on context wasn't optional if it was passed to `unstable_createContext`
> 
> Also thanks a lot for working on that, it's really awesome to use and allowed me to simplify the flow a lot!

### @brophdawg11 — 2 reactions  
`👍 2`  ·  [link](https://github.com/remix-run/react-router/pull/12941#issuecomment-2698005226)

> > resource routes are never nested
> 
> This isn't a limitation?  Resource routes can be nested, and middleware will apply to them just like other nested routes: https://stackblitz.com/edit/github-8b5yasye

### @fullstackwebdev — 1 reactions  
`👀 1`  ·  [link](https://github.com/remix-run/react-router/pull/12941#issuecomment-2693497226)

> Is it possible to modify a request, maybe modify next() to accept a new request object?
> 
> here's some code demonstration the idea:
> 
> ```js
>   // Clone the request using request.clone()
>   const clonedRequest = request.clone();
> 
>   // do something to modify cloned request
> ...
>  
>   // Pass the cloned request to next middleware/loader
>   let response = await next({  /// Allow next to take a clonedRequest so it can be modified
>     request: clonedRequest,
>     params,
>     context
>   });
> ```

### @brophdawg11 — 1 reactions  
`👍 1`  ·  [link](https://github.com/remix-run/react-router/pull/12941#issuecomment-2695497136)

> You can put a generic/route-agnostic middleware anywhere in code and then just import it to all the routes that need it.  If you don't want to use `unstable_MiddlewareFunction` and it's generics, you could just use the root route middleware type, which will have no `params` and be suitable for usage on any route:
> 
> ```ts
> // app/middleware/auth.ts
> import type { Route } from "../+types/root";
> 
> export const authMiddleware: Route.unstable_MiddlewareFunction = async (...) => {...}
> ```
> 
> I did remove the first generic in [a4ed390](https://github.com/remix-run/react-router/pull/12941/commits/a4ed3903dc7781509eb4d4980592e253e2b74154) because middleware should always be used with the new context type, so it should be simplified to `unstable_MiddlewareFunction<Response>` now for server middlewares if you want to use that type directly.

### @brophdawg11 — 0 reactions  
`—`  ·  [link](https://github.com/remix-run/react-router/pull/12941#issuecomment-2695040210)

> @pawelblaszczyk5 Thanks for the feedback!  
> 
> 1/2 - The `context` types should be fixed up by [6b61caa](https://github.com/remix-run/react-router/pull/12941/commits/6b61caac2ea94d20e0c632bc8b70a421cf491b27).  
> 
> 3 - For now I don't think we'll do a non-`Route` specific middleware type for initial release because that would mean we don't have type-safe `params` for those middlewares.  You can always just `import { Route } from "./+types/root` for top-level or otherwise param-agnostic middlewares.
> 
> 4 -  I don't think you should ever be directly accessing `defaultValue`, so is that optional type messing with your app code?
> 
> @fullstackwebdev 
> 
> It's an interesting idea - probably not something we'll add for initial release but feel free to open up a Proposal Discussion outlining your concrete use cases and we can see if it's a popular ask from the community?

### @sergiodxa — 0 reactions  
`—`  ·  [link](https://github.com/remix-run/react-router/pull/12941#issuecomment-2695316750)

> > Is it possible to modify a request, maybe modify next() to accept a new request object?
> > 
> > here's some code demonstration the idea:
> > 
> > ```js
> >   // Clone the request using request.clone()
> >   const clonedRequest = request.clone();
> > 
> >   // do something to modify cloned request
> > ...
> >  
> >   // Pass the cloned request to next middleware/loader
> >   let response = await next({  /// Allow next to take a clonedRequest so it can be modified
> >     request: clonedRequest,
> >     params,
> >     context
> >   });
> > ```
> 
> what would you need to change in the request that you couldn't use context to pass to the route loader/action?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
