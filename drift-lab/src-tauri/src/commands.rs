use serde::Serialize;
use tauri::{AppHandle, Runtime};
use uuid::Uuid;

use crate::workflow;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentRun {
    pub run_id: String,
    pub project_path: String,
    pub created_at: String,
    pub issues_found: Option<u32>,
}

#[tauri::command]
pub async fn start_run<R: Runtime>(
    app: AppHandle<R>,
    project_path: String,
) -> Result<String, String> {
    let run_id = Uuid::new_v4().to_string();
    let id_for_task = run_id.clone();
    let path_for_task = project_path.clone();
    let app_for_task = app.clone();

    tauri::async_runtime::spawn(async move {
        if let Err(e) = workflow::execute(app_for_task, id_for_task, path_for_task).await {
            tracing::error!("workflow failed: {e:?}");
        }
    });

    Ok(run_id)
}

#[tauri::command]
pub async fn cancel_run(_run_id: String) -> Result<(), String> {
    // TODO: wire cancellation token registry once long-running stages exist.
    Ok(())
}

#[tauri::command]
pub async fn list_recent_runs<R: Runtime>(_app: AppHandle<R>) -> Result<Vec<RecentRun>, String> {
    // TODO: read from sqlite once the schema exists.
    Ok(vec![])
}
