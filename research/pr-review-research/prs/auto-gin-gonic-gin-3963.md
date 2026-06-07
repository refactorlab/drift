# gin-gonic/gin #3963 — refactor(context): refactor `Keys` type to `map[any]any`

**[View PR on GitHub](https://github.com/gin-gonic/gin/pull/3963)**

| | |
|---|---|
| **Author** | @flc1125 |
| **Status** | ✅ merged |
| **Opened** | 2024-05-10 |
| **Repo importance** | ★88,612 · 8,623 forks · score 128,082 |
| **Diff** | +83 / −43 across 4 files |
| **Engagement** | 20 conversation · 6 inline review comments |

## Top review comments (ranked by reactions)

### @dmitry-novozhilov — 3 reactions  
`👍 3`  ·  [link](https://github.com/gin-gonic/gin/pull/3963#issuecomment-2257939942)

> > if somebody write code like this, this pr make it build fail
> 
> But gin.Context is an implementation of context.Context.
> 
> And it is a broken implementation, because keys should be any, like in the original context.Context.
> 
> And so this change is more important, because it fixes this bug.

### @jarrodhroberson — 1 reactions  
`👍 1`  ·  [link](https://github.com/gin-gonic/gin/pull/3963#issuecomment-2120784211)

> In Golang, maps can only have keys of types that are considered *comparable*.
> This means the type needs to support the == and != operators for comparison.
> 
> which means that structs have to have nothing but  *comparable*  types as
> their fields.
> 
> it introduces confusion when someone tries to use a key that is not
> *comparable.*
> 
> *comparable *is broken as far as I am concerned, not being able to provide
> a function that makes any struct *comparable* is a serious oversight and
> flaw with the language.
> 
> I have ended up having to write a library that generates a unique hash of
> any struct so that I can pass an array of structs I want to use as keys and
> array of values and generate a map with consistent hashing of the identity
> (fingerprint) of a struct as a key and the struct as the value. This allows
> me to generate keys from structs and look them up in the map without having
> to worry about if something I want to store in a map key is a valid key or
> not.
> 
> On Tue, May 14, 2024 at 11:24 AM Flc゛ ***@***.***> wrote:
> 
> > Why not just make it comparable, or just any?
> >
> > I think it's just like the key in context.WithValue(ctx, key, value).
> >
> > It can be supported, so why not?
> >
> > Moreover, when the key is set to struct{}, it saves more memory, ex:
> >
> > type customKey struct{}
> > ctx.Set(customKey{}, "xxx")
> >
> > —
> > Reply to this email directly, view it on GitHub
> > <https://github.com/gin-gonic/gin/pull/3963#issuecomment-2110524488>, or
> > unsubscribe
> > <https://github.com/notifications/unsubscribe-auth/AABF7754OZ67JDDN5LWVVBDZCIUERAVCNFSM6AAAAABHQT7FSWVHI2DSMVQWIX3LMV43OSLTON2WKQ3PNVWWK3TUHMZDCM … *[truncated]*

### @flc1125 — 1 reactions  
`👍 1`  ·  [link](https://github.com/gin-gonic/gin/pull/3963#issuecomment-2121447352)

> > In Golang, maps can only have keys of types that are considered *comparable*.
> > 
> > This means the type needs to support the == and != operators for comparison.
> > 
> > 
> > 
> > which means that structs have to have nothing but  *comparable*  types as
> > 
> > their fields.
> > 
> > 
> > 
> > it introduces confusion when someone tries to use a key that is not
> > 
> > *comparable.*
> > 
> > 
> > 
> > *comparable *is broken as far as I am concerned, not being able to provide
> > 
> > a function that makes any struct *comparable* is a serious oversight and
> > 
> > flaw with the language.
> > 
> > 
> > 
> > I have ended up having to write a library that generates a unique hash of
> > 
> > any struct so that I can pass an array of structs I want to use as keys and
> > 
> > array of values and generate a map with consistent hashing of the identity
> > 
> > (fingerprint) of a struct as a key and the struct as the value. This allows
> > 
> > me to generate keys from structs and look them up in the map without having
> > 
> > to worry about if something I want to store in a map key is a valid key or
> > 
> > not.
> > 
> > 
> > 
> > On Tue, May 14, 2024 at 11:24 AM Flc゛ ***@***.***> wrote:
> > 
> > 
> > 
> > > Why not just make it comparable, or just any?
> > 
> > >
> > 
> > > I think it's just like the key in context.WithValue(ctx, key, value).
> > 
> > >
> > 
> > > It can be supported, so why not?
> > 
> > >
> > 
> > > Moreover, when the key is set to struct{}, it saves more memory, ex:
> > 
> > >
> > 
> > > type customKey struct{}
> > 
> > > ctx.Set(customKey{}, "xxx")
> > 
> > >
> > 
> > > —
> > 
> > > Reply to this email directly, view it on GitHub
> > 
> > > <https://github.com/gin-gonic/gin/pull/3963#issuecom … *[truncated]*

### @jarrodhroberson — 1 reactions  
`👍 1`  ·  [link](https://github.com/gin-gonic/gin/pull/3963#issuecomment-2129583805)

> > > @jarrodhroberson It is indeed recommended to change to `map[comparable]any` for better practice, but unfortunately, Go does not support this format. After checking the official documentation, no better solution has been found. Therefore, I have maintained the `map[any]any` format and added some unit test scripts.
> > > https://github.com/gin-gonic/gin/pull/3963/files#diff-e6ce689a25eaef174c2dd51fe869fabbe04a6c6afbd416b23eda138c82e761baR220-R247
> > > Some references: [golang/go#51384](https://github.com/golang/go/issues/51384)
> > 
> > Yep went over source and there's no exposed `func` that could be turned into interface type with the given signature. Closest thing was `cmp` package but builtin types don't conform to its `Equal`.
> 
> That is one of the inherit flaws of Go in reaction to all the insanely stupid things that other languages (JS cough cough) allow you to do. The inability to define an `comparable` function for your own types is one of them. Thanks for all the work on trying to so some kind of qualify life enhancements. If the Gin team would just make this an Interface it would make all this irrelevant.

### @xiaotushaoxia — 1 reactions  
`👍 1`  ·  [link](https://github.com/gin-gonic/gin/pull/3963#issuecomment-2201940838)

> break backwards. looks not good for me. 
> if somebody write code like this, this pr make it build fail
> ```go
> func handleTest(c *gin.Context)  {
> 	var cpKeys = make(map[string]any, len(c.Keys))
> 	for s, a := range c.Keys {
> 		cpKeys[s] = a
> 	}
> 	// ....
> }
> 
> ```

### @appleboy — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/gin-gonic/gin/pull/3963#issuecomment-2899570879)

> wait https://github.com/gin-gonic/gin/pull/4245 PR merge.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
