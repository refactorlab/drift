use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum StepStatus {
    // Part of the StepStatus wire contract consumed by the frontend; the backend
    // never emits Pending (steps start as Active), but the variant must exist so
    // the serde representation stays in sync with desktop-ui's StepStatus type.
    #[allow(dead_code)]
    Pending,
    Active,
    Done,
    Error,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StepUpdate {
    pub run_id: String,
    pub index: usize,
    pub status: StepStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RunComplete {
    pub run_id: String,
    pub issues_found: u32,
    pub critical_count: u32,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RunError {
    pub run_id: String,
    pub message: String,
}

pub mod topic {
    pub const STEP: &str = "run://step";
    pub const COMPLETE: &str = "run://complete";
    pub const ERROR: &str = "run://error";

    pub const BACKEND_STATUS: &str = "backend:status";

    /// Iterative-agent stream events (see `agent` module). One event per
    /// `AgentEvent` variant — payload is the serialised enum.
    pub const AGENT_EVENT: &str = "agent:event";
}

/// Coarse lifecycle of the LLM backend, broadcast as `backend:status` events.
#[derive(Debug, Serialize, Clone)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum BackendStatus {
    /// No persisted config — the welcome path.
    Unconfigured,
    /// Config persisted but the OpenAI-compatible client hasn't been built yet.
    Idle { mode: String, model: String },
    /// Resolving the client (building HTTP client, validating URL).
    Starting,
    /// Ready to take chat requests.
    Ready { mode: String, model: String },
    /// Last resolve attempt failed.
    Error { message: String },
}
