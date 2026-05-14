use serde::{Deserialize, Serialize};

/// One streaming event sent over the Tauri Channel during `start_patch`.
/// Tagged union — the frontend gets `{ type: "delta", text: "..." }` etc.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PatchEvent {
    /// Sent once before the LLM stream opens.
    Started { request_id: String },
    /// One non-empty text chunk from the provider. UI appends to its buffer.
    Delta { text: String },
    /// Stream drained successfully. `full_text` is canonical — the UI uses it
    /// to reconcile in case any deltas were dropped.
    Done { full_text: String },
    /// Provider error, parse error, cancellation, etc.
    Error { message: String },
}

/// What the frontend passes to `apply_patch` after the user clicks Apply.
/// We hand the parsed sections directly so the server doesn't need to
/// re-parse the streaming buffer.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyArgs {
    pub file: String,
    pub start_line: usize,
    pub original: String,
    pub replacement: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResult {
    pub ok: bool,
    pub items: Vec<ApplyItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyItem {
    pub kind: String,
    pub file_path: String,
    pub success: bool,
    pub message: Option<String>,
}
