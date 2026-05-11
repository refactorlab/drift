//! In-house iterative agent loop — see `goose_examples/plan-iterative-agent.md`
//! for the architectural rationale.
//!
//! Layout mirrors the four steps in the plan:
//!   - `types`     — wire types every provider lowers into.
//!   - `provider`  — the **single trait** every backend implements.
//!   - `openai`    — one concrete provider (OpenAI-compatible HTTP/SSE).
//!     The same impl drives api.openai.com **and** local
//!     llama-server because both speak the same protocol.
//!   - `tools`     — registry that funnels `MessageContent::ToolRequest`
//!     into the existing `crate::tools::*` modules.
//!   - `agent_loop`— outer turn loop + inner stream-drain.
//!
//! Why a parallel module instead of replacing the existing rig-based chat?
//! The two coexist deliberately: rig handles the simple "one assistant
//! message per user prompt" path; this module handles iterative tool-using
//! turns where the loop has to drive multiple provider round-trips.

pub mod agent_loop;
pub mod openai;
pub mod provider;
pub mod tools;
pub mod types;
pub mod workflow;

// Re-exports — flat names callers will use. `#[allow]` because not every
// re-export has a caller yet; it's the supported surface for future code.
#[allow(unused_imports)]
pub use agent_loop::{Agent, AgentEvent, DEFAULT_MAX_TURNS};
#[allow(unused_imports)]
pub use openai::OpenAiProvider;
#[allow(unused_imports)]
pub use provider::{MessageStream, Provider};
#[allow(unused_imports)]
pub use tools::{Mode, Permission};
#[allow(unused_imports)]
pub use types::{Message, MessageContent, ProviderError, Role, ToolDef, Usage};
