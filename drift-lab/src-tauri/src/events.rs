use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum StepStatus {
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
}
