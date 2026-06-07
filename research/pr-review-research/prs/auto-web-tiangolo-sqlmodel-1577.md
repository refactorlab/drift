# tiangolo/sqlmodel #1577 — 🐛 Fix `alias` support for Pydantic v2

**[View PR on GitHub](https://github.com/tiangolo/sqlmodel/pull/1577)**

| | |
|---|---|
| **Author** | @ravishan16 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @YuriiMotov
> The idea looks good to me! I think it would be nice to use `alias` as a default value for DB column. It can then be overridden by `sa_column=Column("column_name")`

### @YuriiMotov
> Pydantic's `validation_alias` type annotation is wider (`validation_alias: str | AliasPath | AliasChoices | None`), but I think it's fine if we only support `str` for now and extend it later

### @YuriiMotov
> I simplified code a bit - moved alias propagation logic to `Field.__init__` so that it would be all in one place. Also, got rid of deprecation warnings in test.

### @YuriiMotov
> Implementation is not breaking... The only use case it can break is if users use `Field(schema_extra={"validation_alias": "field_alias"})` and want to use this model with both, Pydantic V1 and V2.

### @tiangolo
> Awesome, thank you @ravishan16! 🚀 And thanks @YuriiMotov! 🍰 This will be available in SQLModel 0.0.29, released in the next hours. 🎉

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
