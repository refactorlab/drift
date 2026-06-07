# rust-lang/rfcs #3681 — [RFC] Default field values

**[View PR on GitHub](https://github.com/rust-lang/rfcs/pull/3681)**

| | |
|---|---|
| **Author** | @estebank |
| **Status** | ✅ merged |
| **Opened** | 2024-08-22 |
| **Repo** | curated review-culture seed |
| **Diff** | +1977 / −0 across 1 files |
| **Engagement** | 65 conversation · 139 inline review comments |

## Top review comments (ranked by reactions)

### @traviscross — 27 reactions  
`❤️ 27`  ·  [link](https://github.com/rust-lang/rfcs/pull/3681#issuecomment-2453579493)

> The team has accepted this RFC, and we've now **merged** it.
> 
> Thanks to @estebank for writing this up and pushing it forward, and thanks to all the many people who reviewed this and provided helpful feedback.
> 
> For further updates, follow the tracking issue:
> 
> - https://github.com/rust-lang/rust/issues/132162

### @PoignardAzur — 8 reactions  
`👍 8`  ·  [link](https://github.com/rust-lang/rfcs/pull/3681#issuecomment-2395005441)

> > There is no reason why a struct couldn't have multiple sets of defaults.
> 
> I think in general, defaults mean "the single set of values people would expect this type to have if they didn't think about it too much". It's an easy Schelling point. If your type has multiple sets of possible defaults, it probably shouldn't have default fields *or* implement the Default trait.

### @estebank — 7 reactions  
`❤️ 7`  ·  [link](https://github.com/rust-lang/rfcs/pull/3681#issuecomment-2316337967)

> I believe I've addressed most of the comments (and have collapsed conversations to make way for new ones). Feel free to add additional comments for anything that might be missing.
> 
> As a recurring thing: I believe we need to target the minimal version of this feature that does not block future expansion.
> 
> Whether building `Config { .. }` where `Config` has private fields is allowed one that needs to be defined somewhat one way or another. If it is allowed by default, then the interaction with `#[non_exhaustive]` needs to be defined. If it is allowed as opt-in, then the conversation can be delayed.
> 
> I strongly believe that allowing non-`const` default values, at least at start, is not a good idea, while it can always be extended later. I'm also looking forward for `~const Default` to be a thing in the `std`.
> 
> Whether `enum` struct variant support should be included in the first version or not is one I flip-flop on myself: currently we can only `#[default]` unit variants, so the either we add the literal `Enum::Variant { .. }` support without expanded `#[derive(Default)]` support, extend the `#[derive(Default)]`/`#[default]` support to work only if all fields are defaulted, extend the support to work with `Default::default()` when possible with imperfect derives, or we withhold support for `Enum::Variant { .. }` until this gets resolved. None of the options are ideal, as they will all end up with a special case for general rules, one way or another.
> 
> I have a pretty functional implementation of the feature (with some of the above questions answered in the way that made it easi … *[truncated]*

### @tmccombs — 7 reactions  
`👍 7`  ·  [link](https://github.com/rust-lang/rfcs/pull/3681#issuecomment-2439696755)

> > my mind puts it as “simple and free”
> 
> With the initial expression being constrained to const expressions, most of the work is done at compile time, and at runtime is still simple and almost free

### @tmandry — 6 reactions  
`👍 2 · ❤️ 4`  ·  [link](https://github.com/rust-lang/rfcs/pull/3681#issuecomment-2359685895)

> Overall I'm a huge fan of this RFC. I would like to see more on the treatment of `#[non_exhaustive]` and private fields, so let me provide a use case that can act as a bit of motivation.
> 
> I don't think we can realistically "punt" here: Disallowing use of `Foo { .. }` outside a module is very important for typestate patterns, and therefore any way of doing that will need to continue being supported in the future.
> 
> ## Our use case: The `repr(C)` options struct
> 
> Let's say we want to have a struct like the following.
> 
> ```rust
> #[repr(C)]
> #[non_exhaustive]
> pub struct zx_packet_page_request_t {
>     pub command: u16,
>     pub flags: u16 = 0,
>     reserved0: u32 = 0,
>     pub offset: u64,
>     pub length: u64,
>     reserved1: u64 = 0,
> }
> ```
> 
> Here we have a `repr(C)` struct whose layout cannot change, but which might add fields that use up the space in `reserved0` and `reserved1` in the future. We are constrained in the future evolution that setting the bytes that correspond to `reserved0` and `reserved1` to zero must retain the same meaning as today.
> 
> It would not be appropriate to specify defaults for all fields, but we can specify defaults for some of them. The struct is `#[non_exhaustive]` because we might add more field names in the future, and any places that list all field names will need to account for this with `..`. It also has private fields because the names `reserved0` and `reserved1` might disappear (or change types) in the future.
> 
> We would like users to be able to specify a value of this struct like this: `zx_packet_page_request_t { command: ZX_PAGER_VMO_READ, offset: 0, l … *[truncated]*

### @CraftSpider — 6 reactions  
`👍 6`  ·  [link](https://github.com/rust-lang/rfcs/pull/3681#issuecomment-2372737375)

> That first part sounds very annoying, as a user - I often manually override Default just to change one or two fields, but now I have to add `= 0` (or an even more complex expression) to every other field anyways. Which is noisy and, at least to me, feels like a very artificial restriction for a situation that has an incredibly obvious expected behavior. I'd expect at least deriving to work.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
