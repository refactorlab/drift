# infiniflow/ragflow #14087 — Fix: validate kb_ids as UUIDs before SQL interpolation in use_sql

**[View PR on GitHub](https://github.com/infiniflow/ragflow/pull/14087)**

| | |
|---|---|
| **Author** | @xingxing21 |
| **Status** | ✅ merged |
| **Opened** | 2026-04-13 |
| **Repo importance** | ★81,972 · 9,443 forks · score 124,743 |
| **Diff** | +88 / −94 across 2 files |
| **Engagement** | 38 conversation · 27 inline review comments |

## Top review comments (ranked by reactions)

### @xingxing21 — 0 reactions  
`—`  ·  [link](https://github.com/infiniflow/ragflow/pull/14087#issuecomment-4241701857)

> Hi @xugangqiang
> I hope you’re doing well.
> I wanted to kindly ask if you might have time to take a look at this PR when convenient. I’d really appreciate any feedback or suggestions you may have.
> 
> Thank you for your time and for maintaining the project!

### @xingxing21 — 0 reactions  
`—`  ·  [link](https://github.com/infiniflow/ragflow/pull/14087#issuecomment-4257555377)

> @xugangqiang 
> I added your suggestion above
> Please check it again 😉

### @xugangqiang — 0 reactions  
`—`  ·  [link](https://github.com/infiniflow/ragflow/pull/14087#issuecomment-4259902743)

> @xingxing21 
> Could you please help to check if such issues exist in other files?
> Also, please help to do regression tests and share the testing evidence.

### @xingxing21 — 0 reactions  
`—`  ·  [link](https://github.com/infiniflow/ragflow/pull/14087#issuecomment-4260912395)

> ```python
> 
> import uuid, re
> 
> def _validate_uuid(value, label='id'):
>     try:
>         canonical = str(uuid.UUID(str(value)))
>     except (ValueError, AttributeError, TypeError):
>         raise ValueError(f'Invalid {label} format: {value!r}')
>     return canonical
> 
> canonical_re = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
> 
> tests = [
>     ('123e4567-e89b-12d3-a456-426614174000', True,  '123e4567-e89b-12d3-a456-426614174000'),
>     ('123e4567e89b12d3a456426614174000',      True,  '123e4567-e89b-12d3-a456-426614174000'),
>     ('{123e4567-e89b-12d3-a456-426614174000}',True,  '123e4567-e89b-12d3-a456-426614174000'),
>     ('123E4567-E89B-12D3-A456-426614174000',  True,  '123e4567-e89b-12d3-a456-426614174000'),
>     ('not-a-uuid-at-all',                     False, None),
>     (123456,                                  False, None),
> ]
> 
> all_pass = True
> for val, should_pass, expected in tests:
>     try:
>         result = _validate_uuid(val)
>         if not should_pass:
>             print(f'FAIL {val!r}: expected ValueError, got {result!r}')
>             all_pass = False
>         elif result != expected:
>             print(f'FAIL {val!r}: expected {expected!r}, got {result!r}')
>             all_pass = False
>         elif not canonical_re.match(result):
>             print(f'FAIL {val!r}: result not canonical: {result!r}')
>             all_pass = False
>         else:
>             print(f'PASS {val!r} -> {result!r}')
>     except ValueError as e:
>         if should_pass:
>             print(f'FAIL {val!r}: unexpected ValueError: {e}')
>             all_pass = False
>         else: … *[truncated]*

### @xingxing21 — 0 reactions  
`—`  ·  [link](https://github.com/infiniflow/ragflow/pull/14087#issuecomment-4260968502)

> @xugangqiang 
> 
> Only one real case remains. The MCP client files, `tts_model.py`, and `agent/canvas.py` all just contain hardcoded example UUID values — not validation logic.
> 
> The only similar issue is in `api/utils/validation_utils.py` at `validate_pipeline_id` (lines 638–656):
> 
> ```python
> # Current: manual length + hexdigits check
> if len(v) != 32:
>     raise PydanticCustomError("format_invalid", "pipeline_id must be 32 hex characters")
> if any(ch not in string.hexdigits for ch in v):
>     raise PydanticCustomError("format_invalid", "pipeline_id must be hexadecimal")
> return v.lower()
> ```
> This has the same flaw — it only accepts the no-hyphen hex form and does it manually. It could be replaced with:
> 
> ```python
> try:
>     return uuid.UUID(v).hex   # accepts any valid UUID format, normalises to 32-char lowercase hex
> except (ValueError, AttributeError, TypeError):
>     raise PydanticCustomError("format_invalid", "pipeline_id must be a valid UUID")
> ```
> The `validate_uuid1_hex` function directly above it (line 327) already uses `uuid.UUID()` correctly, so `validate_pipeline_id` is the odd one out.

### @xugangqiang — 0 reactions  
`—`  ·  [link](https://github.com/infiniflow/ragflow/pull/14087#issuecomment-4264977517)

> @xingxing21 
> 
> I can see the unit test is good.
> 
> Could you please help to do regression test to make sure the whole system still works with your fix?
> 
> Regression testing is a type of software testing that ensures recent code changes (e.g., bug fixes, new features, or performance improvements) have not broken or degraded the existing functionality of the application.
> 
> In simple terms: You re-run old tests to make sure your new code didn't break anything that used to work.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
