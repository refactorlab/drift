//! Parallel-track detectors that share the ORM pipeline's
//! `PyOrmContext` infrastructure but aren't ORM-specific:
//!
//! - `llm` — LLM API perf antipatterns (client per request, sync in
//!   async handler, calls in loop, missing batching/caching).
//! - `auth_crypto` — Auth/crypto perf antipatterns (bcrypt in loop,
//!   JWKS per request, RSA keygen in handler).
//!
//! Both layers run on Python files via the same Python tree-sitter
//! walker used by Django/SQLAlchemy.

pub mod auth_crypto;
pub mod llm;
