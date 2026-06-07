# numpy/numpy #29129 — ENH: add a casting option 'same_value' and use it in np.astype

**[View PR on GitHub](https://github.com/numpy/numpy/pull/29129)**

| | |
|---|---|
| **Author** | @mattip |
| **Status** | ✅ merged |
| **Opened** | 2025-06-05 |
| **Repo** | curated review-culture seed |
| **Diff** | +703 / −154 across 38 files |
| **Engagement** | 50 conversation · 107 inline review comments |

## Top review comments (ranked by reactions)

### @mattip — 1 reactions  
`👍 1`  ·  [link](https://github.com/numpy/numpy/pull/29129#issuecomment-3110198064)

> I think it makes sense to do the most conservative thing and require "ability to accurately round-trip" for `'same_value'` in this first implementation.

### @mattip — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/numpy/numpy/pull/29129#issuecomment-3228189494)

> [Mailing list thread](https://mail.python.org/archives/list/numpy-discussion@python.org/thread/T7BBTQBZWTVF4JNEOIEEMKH37A5ZLV6O/)

### @mattip — 1 reactions  
`😕 1`  ·  [link](https://github.com/numpy/numpy/pull/29129#issuecomment-3258343693)

> Not sure what I can make out from the benchmarks. I compared the branch to the last commit on `main` with `spin bench --compare 73f8bd0f72 HEAD -t bench_ufunc.NDArrayAsType.time_astype`.
> ```
> | Change   | Before [73f8bd0f] <max_errors_indices~9>   | After [534fe16e] <value-based>   |   Ratio | Benchmark (Parameter)                                            |
> |----------|--------------------------------------------|----------------------------------|---------|------------------------------------------------------------------|
> | +        | 6.20±0.2μs                                 | 6.72±0.04μs                      |    1.08 | bench_ufunc.NDArrayAsType.time_astype(('float32', 'int64'))      |
> | +        | 2.06±0.03μs                                | 2.21±0.02μs                      |    1.07 | bench_ufunc.NDArrayAsType.time_astype(('int16', 'int32'))        |
> | +        | 6.38±0.07μs                                | 6.85±0.1μs                       |    1.07 | bench_ufunc.NDArrayAsType.time_astype(('int64', 'float64'))      |
> | -        | 2.97±0.01μs                                | 2.80±0.06μs                      |    0.94 | bench_ufunc.NDArrayAsType.time_astype(('int32', 'complex64'))    |
> | -        | 20.1±0.05μs                                | 18.0±0.2μs                       |    0.89 | bench_ufunc.NDArrayAsType.time_astype(('float16', 'float64'))    |
> | -        | 20.5±0.2μs                                 | 18.2±0.3μs                       |    0.88 | bench_ufunc.NDArrayAsType.time_astype(('float16', 'complex64'))  |
> | -        | 2.95±0.02μs … *[truncated]*

### @mhvk — 1 reactions  
`👍 1`  ·  [link](https://github.com/numpy/numpy/pull/29129#issuecomment-3259166925)

> Benchmarks are indeed weird. Not sure what to say about the size increase; I guess a partial solution would be to not duplicate loops where we know `same_value` is guaranteed (say `int8` -> `int16`, etc.). I think it would be fine to do that in follow-up, though (i.e., raise an issue about it).

### @mattip — 1 reactions  
`👍 1`  ·  [link](https://github.com/numpy/numpy/pull/29129#issuecomment-3263832678)

> I ran a benchmark where I disabled the internal dispatching in each call to the function, and the results showed that this is the cause of the slowdown:
> ```diff
>  static GCC_CAST_OPT_LEVEL int
>  @prefix@_cast_@name1@_to_@name2@(
>          PyArrayMethod_Context *context, char *const *args,
>          const npy_intp *dimensions, const npy_intp *strides,
>          NpyAuxData *data)
>  {
> -#if !@is_bool2@
> +#if 0 && !@is_bool2@
>      int same_value_casting = ((context->flags & NPY_SAME_VALUE_CONTEXT_FLAG) == NPY_SAME_VALUE_CONTEXT_FLAG);
>      if (same_value_casting) {
>          return @prefix@_cast_@name1@_to_@name2@_same_value(context, args, dimensions, strides, data);
>      } else {
>  #else
>      {
>  #endif
>          return @prefix@_cast_@name1@_to_@name2@_no_same_value(context, args, dimensions, strides, data);
>  }}
> ```
> 
> So that would indicate that a path to restore the degradation in performance would be to avoid the `same_value` flag check when casting is safe.

### @mattip — 1 reactions  
`😕 1`  ·  [link](https://github.com/numpy/numpy/pull/29129#issuecomment-3267817102)

> There is still a slowdown, even when disabling the `same_value` check and dispatching. Playing with a [version of the code in the compiler explorer](https://godbolt.org/z/W5G5z16qz), I think the `NPY_GCC_OPT_3` attribute is insufficient to efficiently inline things to get rid of function calls. I need to decorate the half conversion utilities as well, and also inline the `To BitCast(const From &from)`
> 
> I also noticed the benchmarks are using `itertools.combinations()` and not `itertools.product`, so we are only benchmarking half the casting type combinations.
> 
> Edit: we cannot inline things like the float16 conversion routines, since they come from `libnpymath.a` which we link to.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
