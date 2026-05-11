//! The Provider trait — the **single point of polymorphism** in this module.
//!
//! Implement `stream()` and you get the entire agent loop (turn budget, tool
//! dispatch, cancellation, permission gating) for free. The agent never
//! inspects which provider it has — it just consumes `MessageStream` items.
//!
//! See `goose_examples/plan-iterative-agent.md` §2.

use std::pin::Pin;

use async_trait::async_trait;
use futures_util::Stream;

use super::types::{Message, ProviderError, ToolDef, Usage};

/// Stream item: any provider may yield interim text, a tool-request delta,
/// or a terminal usage frame. Both halves of the tuple are optional so a
/// provider can emit just a delta, just usage, or both at once.
pub type MessageStream = Pin<
    Box<dyn Stream<Item = Result<(Option<Message>, Option<Usage>), ProviderError>> + Send>,
>;

#[async_trait]
pub trait Provider: Send + Sync {
    fn name(&self) -> &str;

    /// Open a streaming completion. Returns one `MessageStream` per call —
    /// the agent loop drains it then drops it before starting the next turn.
    async fn stream(
        &self,
        system: &str,
        messages: &[Message],
        tools: &[ToolDef],
    ) -> Result<MessageStream, ProviderError>;
}
