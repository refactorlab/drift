//! Parallel-track detectors that share the ORM pipeline's
//! `PyOrmContext` infrastructure but aren't ORM-specific:
//!
//! - `llm` — LLM API perf antipatterns (client per request, sync in
//!   async handler, calls in loop, missing batching/caching).
//! - `auth_crypto` — Auth/crypto perf antipatterns (bcrypt in loop,
//!   JWKS per request, RSA keygen in handler).
//! - `react` — React UI-framework anti-patterns (async effects,
//!   `dangerouslySetInnerHTML`, hooks-in-loops, index keys).
//!
//! The Python layers (llm, auth_crypto) run on Python files via the same
//! tree-sitter walker used by Django/SQLAlchemy; `react` runs on TS/JS files
//! via the TypeScript context builder.

pub mod auth_crypto;
pub mod llm;
pub mod react;
