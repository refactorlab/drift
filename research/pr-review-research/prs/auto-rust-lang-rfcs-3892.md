# rust-lang/rfcs #3892 — Complex numbers

**[View PR on GitHub](https://github.com/rust-lang/rfcs/pull/3892)**

| | |
|---|---|
| **Author** | @scimind2460 |
| **Status** | ✅ merged |
| **Opened** | 2025-12-02 |
| **Repo** | curated review-culture seed |
| **Diff** | +182 / −0 across 1 files |
| **Engagement** | 39 conversation · 147 inline review comments |

## Top review comments (ranked by reactions)

### @clarfonthey — 15 reactions  
`👍 14 · 😕 1`  ·  [link](https://github.com/rust-lang/rfcs/pull/3892#issuecomment-3603701058)

> It's worth pointing out another big issue with this is that the canonical `a+bi` is not actually the best representation of complex numbers in all cases, and so deciding on this is making a decision that might make life harder for external complex-numeric libraries out there.
> 
> In particular, while `a+bi` (orthogonal) representation is efficient for addition, `r*(iθ).exp()` is more efficient for multiplication, and depending on the equation you're using, it may be advantageous to switch between the two to reduce the number of arithmetic operations needed.
> 
> I'm not super compelled by the argument that C supports this, therefore the standard library needs to support this. I think that guaranteeing a `std::ffi::Complex` representation would be desirable, but there's no saying that we need to make this a canonical type in, say, `std::num`.

### @clarfonthey — 6 reactions  
`👍 4 · ❤️ 1 · 👀 1`  ·  [link](https://github.com/rust-lang/rfcs/pull/3892#issuecomment-3603814739)

> Right: I guess my main clarification here was that due to the polar-orthogonal discrepancy, it shouldn't be a canonical Rust type (e.g. `std::num::Complex` shouldn't be making a decision on which is more-canonical), but I do think that having extra FFI-compatibility types is reasonable and this shouldn't prevent us from adding `std::ffi::Complex` which is orthogonal.

### @clarfonthey — 6 reactions  
`👍 6`  ·  [link](https://github.com/rust-lang/rfcs/pull/3892#issuecomment-3614888199)

> Rust doesn't have to support them, though. Gaussian integers, however useful, are not a primitive that the language needs to offer to everyone and maintain.

### @clarfonthey — 5 reactions  
`👍 5`  ·  [link](https://github.com/rust-lang/rfcs/pull/3892#issuecomment-3613134755)

> The conversion between a polar and orthogonal form isn't lossless, so, it effectively can't be done "automatically" or "as an implementation detail." You need trigonometric functions to do it, and while the conversion is algebraically closed, it's certainly more complicated to do exactly and most people prefer to just use floats instead.
> 
> My point here isn't that we need to decide; the issue is that the decision itself means that we *shouldn't* decide, and instead avoid having a standard `Complex` type for the standard library.
> 
> This doesn't preclude adding `std::ffi::Complex` which allows ABI-compatibility with C's `_Complex`, however, I don't think that such a type should be made standard for the language *because* of the fact that there are so many different ways to go about it.

### @kennytm — 5 reactions  
`❤️ 5`  ·  [link](https://github.com/rust-lang/rfcs/pull/3892#issuecomment-3615501813)

> > I guess my main clarification here was that due to the polar-orthogonal discrepancy
> >
> > [...]
> >
> > My point here isn't that we need to decide; the issue is that the decision itself means that we _shouldn't_ decide, and instead avoid having a standard `Complex` type for the standard library.
> 
> As binary floating point cannot represent $\pi$ exactly, you can't even accurately describe $i\\;(= 1\angle\tfrac\pi2)$ in polar form. In terms of representation it can work if the angle unit uses turns (multiples of $2\pi$) rather than radians. Even so, addition and subtraction under polar form is extremely complicated ($\left(r_1\angle\theta_1\right) + \left(r_2\angle\theta_2\right) = \left(\sqrt{r_1^2+r_2^2+2r_1r_2\cos(\theta_1-\theta_2)}\right)\angle\left(\tan^{-1}\tfrac{r_1\sin\theta_1+r_2\sin\theta_2}{r_1\cos\theta_1+r_2\cos\theta_2}\right)$ ) which outweighs any slight advantages brought by multiplication ($(a_1 + b_1i)\times(a_2+b_2i) = (a_1a_2 - b_1b_2) + (a_1b_2 + a_2b_1)i$ isn't really that costly in comparison), so it does not make sense as default in terms of computation either.
> 
> So I don't see how this is a valid discrepancy in the first place, no sane library will *only* provide a `Complex<T>` type in polar form, it's going to be either always rectilinear, or having multiple convertible choices `StandardComplex<T>`, `PolarComplex<T>`, `EinsensteinComplex<T>` etc.
> 
> If we are going to have a `std::num::Complex<T>`, in additional to the above reasoning, because of easy interoperability with C, C++, etc the rectilinear form is basically the only choice. That is, the "polar f … *[truncated]*

### @programmerjake — 5 reactions  
`👍 4 · ❤️ 1`  ·  [link](https://github.com/rust-lang/rfcs/pull/3892#issuecomment-3615670822)

> > 1. Provide a `Complex<T>` type which is FFI-compatible with C's `_Complex T` at least for `T = f32`, `f64`, and exposes [all methods available in C](https://en.cppreference.com/w/c/numeric/complex.html), or
> > 2. Declare that [`[T; 2]` is FFI-compatible with `_Complex T`](https://github.com/rust-lang/rfcs/pull/3892#discussion_r2591195612) and be done with it. I think it is correct for Clang and GCC, but seems not the case for MSVC.
> 
> Deciding the in-memory representation is the easy part, the hard part is how exactly complex numbers are passed by value in function arguments and return values -- I recall reading ABI specs that treat complex numbers specially such that they don't really match the ABI of any other single type (so it has to be handled specially by rustc and can't just be an existing type), though I can't currently recall which ABI specs.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
