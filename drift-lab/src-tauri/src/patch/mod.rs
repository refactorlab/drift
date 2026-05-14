//! LLM-driven single-location patch: takes (file, line, prompt), streams a
//! structured suggested-fix back over a Tauri Channel, and applies the
//! parsed change to disk via `udiffx` when the user approves.
//!
//! The streaming model mirrors OpenAI chat completions: each non-empty text
//! chunk from `Provider::stream` is forwarded as one `PatchEvent::Delta`.
//! The UI accumulates these and re-extracts the structured sections on
//! every render — same pattern as `scan/suggester.rs`, ported to Channel.

pub mod commands;
pub mod types;
