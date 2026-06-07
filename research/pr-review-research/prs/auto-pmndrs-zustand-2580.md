# pmndrs/zustand #2580 — fix(types)!: require complete state if `setState`'s `replace` flag is set

**[View PR on GitHub](https://github.com/pmndrs/zustand/pull/2580)**

| | |
|---|---|
| **Author** | @Yonom |
| **Status** | ✅ merged |
| **Opened** | 2024-06-04 |
| **Repo importance** | ★58,206 · 2,066 forks · score 71,444 |
| **Diff** | +104 / −17 across 6 files |
| **Engagement** | 28 conversation · 6 inline review comments |

## Top review comments (ranked by reactions)

### @dai-shi — 1 reactions  
`👍 1`  ·  [link](https://github.com/pmndrs/zustand/pull/2580#issuecomment-2146454306)

> > which causes the default to suggest replace: true, since it has a shorter definition
> 
> Oh, that sounds pretty bad. `replace` would only be used less than say 1% users...

### @dai-shi — 1 reactions  
`👍 1`  ·  [link](https://github.com/pmndrs/zustand/pull/2580#issuecomment-2146458247)

> > I disagree with defaulting to `replace` to true.
> 
> It's not about changing the logic. It's just about typing. Yet...

### @devanshj — 1 reactions  
`👍 1`  ·  [link](https://github.com/pmndrs/zustand/pull/2580#issuecomment-2154446508)

> FWIW there's already a PR with the same goal by me [here](https://github.com/pmndrs/zustand/pull/944).
> 
> This PR's approach would break things like this...
> 
> ```ts
> let foo = Math.random() > 0.5 ? true : false
> store.setState({ bears: 5 }, foo) // error
> ```
> 
> Here's a minimal reproduction...
> ```ts
> declare const f: {
>   (a: true): void
>   (a: false): void
> }
> 
> let foo = Math.random() > 0.5 ? true : false
> f(foo) // error
> ```

### @dai-shi — 1 reactions  
`👍 1`  ·  [link](https://github.com/pmndrs/zustand/pull/2580#issuecomment-2196190872)

> Thanks.
> 
> It's my bad https://github.com/pmndrs/zustand/pull/2138#issuecomment-2125944985, but the migration doc is under `docs/guides` currently. (I will move it around after merging the v5 branch.)
> 
> Can you move your notes into it?

### @Yonom — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/pmndrs/zustand/pull/2580#issuecomment-2197796049)

> Whew! Thanks a lot for all the guidance along the way, this was way more complicated than originally expected 😀

### @Yonom — 0 reactions  
`—`  ·  [link](https://github.com/pmndrs/zustand/pull/2580#issuecomment-2146444458)

> The user is now presented with two function signatures. These seem to be sorted by the length of their definition text, which causes the default to suggest replace: true, since it has a shorter definition
> 
> <img width="495" alt="Screenshot 2024-06-03 at 19 18 18" src="https://github.com/pmndrs/zustand/assets/1394504/7f8bcba0-617e-4544-b72d-df7a18c5d08b">
> 
> <img width="459" alt="Screenshot 2024-06-03 at 19 18 23" src="https://github.com/pmndrs/zustand/assets/1394504/9d5415fc-e72e-412a-9234-8a3719fc5933">


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
