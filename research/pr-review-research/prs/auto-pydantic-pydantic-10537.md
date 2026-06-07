# pydantic/pydantic #10537 — Add `rebuild()` method for `TypeAdapter` and simplify `defer_build` patterns

**[View PR on GitHub](https://github.com/pydantic/pydantic/pull/10537)**

| | |
|---|---|
| **Author** | @sydney-runkle |
| **Status** | ✅ merged |
| **Opened** | 2024-10-01 |
| **Repo** | curated review-culture seed |
| **Diff** | +281 / −178 across 4 files |
| **Engagement** | 14 conversation · 70 inline review comments |

## Top review comments (ranked by reactions)

### @Viicos — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/pydantic/pydantic/pull/10537#issuecomment-2388861876)

> My best guess regarding why the deferred parent namespace fetching was implemented was to support the following:
> 
> ```python
> from pydantic import TypeAdapter
> 
> def func():
>     ta = TypeAdapter("Forward", config={"defer_build": True})
> 
>     Forward = int
> 
>     ta.core_schema  # triggers the core schema build, and `frame.f_locals` is only fetched at this point, so it includes `Forward`
> ```
> 
> Which presumably won't work anymore with this PR. I'll not that this pattern feels "dangerous", as one can do:
> 
> ```python
> def func():
>     ta = TypeAdapter("Forward", config={"defer_build": True})
> 
>     Forward = int
> 
>     return ta
> 
> ta = func()
> ta.core_schema  # PydanticUndefinedAnnotation: name 'Forward' is not defined, because locals were gc'ed.
> 
> # Things could also be worse, if you defined `Forward = str` before calling `ta.core_schema` here
> ```
> 
> So I think we need to be careful here before making the change. People might be relying on this behavior?

### @sydney-runkle — 1 reactions  
`👍 1`  ·  [link](https://github.com/pydantic/pydantic/pull/10537#issuecomment-2471015472)

> @MarkusSintonen,
> 
> Thanks so much for your prompt feedback. We're really looking forward to a thorough review on your cleaning schema PR, just still trying to get this and a few other things across so we can release v2.10 and then pivot to perf for v2.11 :)

### @sydney-runkle — 0 reactions  
`—`  ·  [link](https://github.com/pydantic/pydantic/pull/10537#issuecomment-2388950889)

> > My best guess regarding why the deferred parent namespace fetching was implemented was to support the following:
> 
> I'd argue that we shouldnt' support rebuilds on attribute accesses for `core_schema`, `validator`, and `serializer`, as we don't do that for `__pydantic_core_schema__`, etc.
> 
> Indeed, this is an issue, but it's one that we run into with `BaseModel` as well, which is why we cache the parent namespace 😢, so maybe we should be doing that for consistency?

### @sydney-runkle — 0 reactions  
`—`  ·  [link](https://github.com/pydantic/pydantic/pull/10537#issuecomment-2388963070)

> I'll note, this works:
> 
> ```py
> from pydantic import BaseModel, TypeAdapter, ConfigDict
> 
> Int = int
> 
> def tester_model() -> None:
>     class Model(BaseModel):
>         i: Int
> 
>         model_config = ConfigDict(defer_build=True)
> 
>     print(Model.__pydantic_core_schema__)
>     # mock core schema
>     Model.model_rebuild()
>     print(Model.__pydantic_core_schema__)
>     # works, displays a core schema
> 
> tester_model()
> 
> def tester_adapter() -> None:
>     ta = TypeAdapter(Int, config=ConfigDict(defer_build=True))
> 
>     print(ta.core_schema)
>     # mock core schema
>     ta.rebuild()
>     print(ta.core_schema)
>     # works, displays a core schema
>   
> tester_adapter()
> ```

### @sydney-runkle — 0 reactions  
`—`  ·  [link](https://github.com/pydantic/pydantic/pull/10537#issuecomment-2391792046)

> Admittedly, I don't think this should undergo serious review until we merge https://github.com/pydantic/pydantic/pull/10530

### @sydney-runkle — 0 reactions  
`—`  ·  [link](https://github.com/pydantic/pydantic/pull/10537#issuecomment-2414187538)

> Closing based on https://github.com/pydantic/pydantic/issues/10632.
> 
> Will resume in v2.11


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
