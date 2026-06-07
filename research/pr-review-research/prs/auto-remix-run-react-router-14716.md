# remix-run/react-router #14716 — Add support for <Link unstable_mask>

**[View PR on GitHub](https://github.com/remix-run/react-router/pull/14716)**

| | |
|---|---|
| **Author** | @brophdawg11 |
| **Status** | ✅ merged |
| **Opened** | 2026-01-08 |
| **Repo** | curated review-culture seed |
| **Diff** | +2442 / −13 across 23 files |
| **Engagement** | 25 conversation · 10 inline review comments |

## Top review comments (ranked by reactions)

### @OliverJAsh — 1 reactions  
`🎉 1`  ·  [link](https://github.com/remix-run/react-router/pull/14716#issuecomment-3729082890)

> @brophdawg11 Just tested it for the Unsplash asset page modal and it seems to work perfectly. 😘

### @jroru — 1 reactions  
`👍 1`  ·  [link](https://github.com/remix-run/react-router/pull/14716#issuecomment-4092409473)

> +1, this caused test failure for us due to the types being modeled as:
> 
> ```ts
> unstable_mask: Path | undefined
> ```
> 
> Wouldn't cause failure if modeled as:
> ```ts
> unstable_mask?: Path
> ```

### @OliverJAsh — 0 reactions  
`—`  ·  [link](https://github.com/remix-run/react-router/pull/14716#issuecomment-3729654779)

> An interesting edge case I just encountered:
> 
> 1. User navigates to a link that has a rewritten URL e.g. `/?page_modal=a` rewritten as `/photos/a`.
> 2. That page has another link which simply adds another query param to the current URL e.g. `foo=bar`.
> 
> ```tsx
>   const location = useLocation();
>   const [searchParams] = useSearchParams();
>   searchParams.set('foo', 'bar');
> 
>   return <Link to={{ pathname: location.pathname, search: searchParams.toString() }}>
>     Add query param
>   </Link>
> ```
> 
> Result: `/?page_modal=a&foo=bar`. We lose the "route masking".
> 
> The old modal setup (using location state) didn't have this problem. The URL in this case would be `/photos/a?foo=bar`.
> 
> TanStack has declarative route masking. I wonder if this would help: https://tanstack.com/router/v1/docs/framework/react/guide/route-masking##declarative-route-masking
> 
> For context, where this shows up in Unsplash is our (nested) modals:
> 
> https://github.com/user-attachments/assets/b0541e80-8fd2-4b79-868b-c5e48ec28f97

### @OliverJAsh — 0 reactions  
`—`  ·  [link](https://github.com/remix-run/react-router/pull/14716#issuecomment-3730237446)

> Something else I noticed is that the location exposed by `router.subscribe` doesn't seem to use the rewritten location, unlike the location exposed by `useLocation`. I'm not sure if this is intentional? Reduced test case:
> 
> https://stackblitz.com/edit/github-p8mgs2ph?file=src%2Fapp.tsx
> 
> <img width="554" height="307" alt="image" src="https://github.com/user-attachments/assets/556bc679-f295-40c4-8f3a-5ac56db7a142" />

### @brophdawg11 — 0 reactions  
`—`  ·  [link](https://github.com/remix-run/react-router/pull/14716#issuecomment-3730480073)

> ~~yeah that's part of the quick nature of this POC - we just stick the `rewrite` field on there.  It sounds like you'd prefer that `useLocation` returns the rewritten location?  Would you want/need access to the "URL location" via `useLocation` as well?~~
> 
> nvm got my wires crossed.  That's because of this quick hack: https://github.com/remix-run/react-router/pull/14716#discussion_r2673991649
> 
> Just to clarify - do you want `useLocation` to expose the URL location or the rewritten location?  And do you want/need the other exposed as well?

### @OliverJAsh — 0 reactions  
`—`  ·  [link](https://github.com/remix-run/react-router/pull/14716#issuecomment-3730589976)

> > Just to clarify - do you want `useLocation` to expose the URL location or the rewritten location? And do you want/need the other exposed as well?
> 
> I expected both the hook and `router.subscribe` to expose the same representation, i.e. the URL that is being rendered (`unstable_rewrite`) rather than the one in the address bar (`to`). But it might be good to have the address bar URL in there as well? Just not as the main value?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
