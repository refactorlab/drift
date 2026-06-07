# moby/moby #47041 — Refactor 'resolv.conf' generation.

**[View PR on GitHub](https://github.com/moby/moby/pull/47041)**

| | |
|---|---|
| **Author** | @robmry |
| **Status** | ✅ merged |
| **Opened** | 2024-01-08 |
| **Repo importance** | ★71,621 · 18,962 forks · score 152,468 |
| **Diff** | +1811 / −781 across 50 files |
| **Engagement** | 16 conversation · 130 inline review comments |

## Top review comments (ranked by reactions)

### @corhere — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/moby/moby/pull/47041#issuecomment-1930812787)

> @robmry `.gitattributes` works better when it's not spelled with three consecutive "t"s. 
> <img width="405" alt="Screenshot 2024-02-06 at 4 54 17 PM" src="https://github.com/moby/moby/assets/274527/0af019f0-2787-4bc0-9611-1a29d1756661">

### @robmry — 0 reactions  
`—`  ·  [link](https://github.com/moby/moby/pull/47041#issuecomment-1908262171)

> Thank you for the review @corhere.
> 
> > We have a perfect opportunity to put the new `ResolvConf` and related code into an `internal` package, which would free us from any compatibility promises. We should do that!
> 
> Are you thinking we should remove the old `resolvconf` package? At the moment, I've preserved its exported functions because I thought we were stuck with them. If I move their new implementation into an `internal` package, they won't be usable.
> 
> So, we could ditch those functions, it seems unlikely anyone's using the package as it was. But, I'm not sure what the opportunity is... nothing's really changed, we could have made it internal at any point?

### @corhere — 0 reactions  
`—`  ·  [link](https://github.com/moby/moby/pull/47041#issuecomment-1908686942)

> > Are you thinking we should remove the old `resolvconf` package? At the moment, I've preserved its exported functions because I thought we were stuck with them. If I move their new implementation into an `internal` package, they won't be usable.
> 
> I would not mind if we removed the old `resolvconf` package, but I was assuming the premise that we were stuck with them. We can move the new _code_ (`type ResolvConf struct` and friends) into an `internal` package, import the `internal` package into the existing `resolvconf` package, and implement the existing `resolvconf` API (`FilterResolvDNS`, `GetNameservers`, etc.) in terms of the `internal` package.

### @robmry — 0 reactions  
`—`  ·  [link](https://github.com/moby/moby/pull/47041#issuecomment-1908864411)

> > I would not mind if we removed the old `resolvconf` package, but I was assuming the premise that we were stuck with them. We can move the new _code_ (`type ResolvConf struct` and friends) into an `internal` package, import the `internal` package into the existing `resolvconf` package, and implement the existing `resolvconf` API (`FilterResolvDNS`, `GetNameservers`, etc.) in terms of the `internal` package.
> 
> Got it... I've moved the new stuff to `libnetwork/internal/resolvconf`.
> 
> I'm not sure if using the same name is a bad idea, but it seems like the right name so I kept it. Happy to change it though.

### @thaJeztah — 0 reactions  
`—`  ·  [link](https://github.com/moby/moby/pull/47041#issuecomment-1930756974)

> Some failures in CI; some of them look to be due to output formatting (empty lines?)
> 
> ```
> === FAIL: github.com/docker/docker/libnetwork/internal/resolvconf TestRCTransformForIntNS (0.08s)
> 
> === FAIL: github.com/docker/docker/libnetwork/internal/resolvconf TestRCInvalidNS (0.00s)
>     resolvconf_test.go:541: assertion failed: 
>         --- expected
>         +++ actual
>         @@ -1,5 +1,5 @@
>         -↵
>         -#·Based·on·host·file:·''↵
>         -#·Invalid·nameservers:·[1.2.3.4.5]↵
>         -#·Overrides:·[]↵
>         +
>         +#·Based·on·host·file:·''
>         +#·Invalid·nameservers:·[1.2.3.4.5]
>         +#·Overrides:·[]
>          
>         
>         
>         You can run 'go test . -update' to automatically update testdata\TestRCInvalidNS.golden to the new expected value.'
> ```

### @robmry — 0 reactions  
`—`  ·  [link](https://github.com/moby/moby/pull/47041#issuecomment-1930807260)

> > oh! perhaps `LF` vs `CRLF`?
> 
> Yes, seems to be, it's getting a bit irritating! The test works for me locally on Windows, but not here.
> 
> The `↵` symbols in the diff output are `\r` characters, so they're in the expected output ... but they weren't in the original `.golden` files. I guess they were added by the git-checkout on Windows.
> 
> I added a `.gitattributes` to try to sort that out, but it didn't help - perhaps because the files were already checked out on the test runner by then. So, with that file in place, I tried adding in the carriage-returns an arbitrary whitespace change to get the files re-checked-out but hopefully not modified because of the `.gitattributes`. That didn't work.
> 
> There's no `.git/info/attributes`, which would override the `.gitattributes`. So, I'm not sure what's happening. (The change I just made removes the `\r` chars again, because they shouldn't have been there anyway - but not expecting the test to pass.)
> 
> Fallbacks I can think of are to go back to not-using `golden` files, or `skipIf Windows`. But neither of those are good plans. Maybe I'll have a better idea by tomorrow.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
