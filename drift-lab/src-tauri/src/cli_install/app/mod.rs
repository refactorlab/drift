//! Use cases — one verb per file.
//!
//! Each module here implements ONE install-plane operation against the
//! traits in [`super::ports`]. No use case may import a concrete adapter
//! from [`super::infra`].
//!
//! Test pattern: every use case ships with a `#[cfg(test)] mod fakes`
//! providing in-memory adapter doubles, mirroring `realtime/app/*`.

pub mod ensure_installed;
