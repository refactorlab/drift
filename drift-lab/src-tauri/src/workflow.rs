//! Workflow engine: sequenced stages that emit progress events to the UI.
//!
//! The current implementation simulates each stage with a tokio sleep so the
//! UI animates end-to-end. Real implementations will plug into [`crate::docker`]
//! (image lookup, layer inspection, profiler injection) and the load runner.

use std::time::{Duration, Instant};

use anyhow::Result;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::time::sleep;

use crate::events::{topic, RunComplete, RunError, StepStatus, StepUpdate};

struct Stage {
    active_detail: &'static str,
    done_detail: &'static str,
    duration: Duration,
}

const STAGES: &[Stage] = &[
    Stage {
        active_detail: "Scanning project for Dockerfile…",
        done_detail: "Found checkout-service:latest (247 MB)",
        duration: Duration::from_millis(1200),
    },
    Stage {
        active_detail: "Inspecting image layers…",
        done_detail: "Python 3.11 · FastAPI · uvicorn",
        duration: Duration::from_millis(1400),
    },
    Stage {
        active_detail: "Injecting py-spy into container…",
        done_detail: "py-spy v0.3.14 installed",
        duration: Duration::from_millis(1700),
    },
    Stage {
        active_detail: "Driving load · 50 RPS for 60s…",
        done_detail: "3,047 samples captured",
        duration: Duration::from_millis(2400),
    },
    Stage {
        active_detail: "Building flame graph & ranking issues…",
        done_detail: "7 issues detected",
        duration: Duration::from_millis(1400),
    },
];

pub async fn execute<R: Runtime>(
    app: AppHandle<R>,
    run_id: String,
    _project_path: String,
) -> Result<()> {
    for (index, stage) in STAGES.iter().enumerate() {
        emit_step(
            &app,
            StepUpdate {
                run_id: run_id.clone(),
                index,
                status: StepStatus::Active,
                detail: Some(stage.active_detail.to_string()),
                duration_ms: None,
            },
        );

        let started = Instant::now();
        if let Err(e) = run_stage(index).await {
            emit_step(
                &app,
                StepUpdate {
                    run_id: run_id.clone(),
                    index,
                    status: StepStatus::Error,
                    detail: Some(format!("{e}")),
                    duration_ms: None,
                },
            );
            let _ = app.emit(
                topic::ERROR,
                RunError {
                    run_id: run_id.clone(),
                    message: e.to_string(),
                },
            );
            return Err(e);
        }
        let elapsed = started.elapsed().as_millis() as u64;

        emit_step(
            &app,
            StepUpdate {
                run_id: run_id.clone(),
                index,
                status: StepStatus::Done,
                detail: Some(stage.done_detail.to_string()),
                duration_ms: Some(elapsed),
            },
        );
    }

    let _ = app.emit(
        topic::COMPLETE,
        RunComplete {
            run_id,
            issues_found: 7,
            critical_count: 3,
        },
    );

    Ok(())
}

async fn run_stage(index: usize) -> Result<()> {
    // Placeholder: real implementations dispatch on `index` to call
    // `docker::find_image`, `docker::inspect_layers`, etc.
    sleep(STAGES[index].duration).await;
    Ok(())
}

fn emit_step<R: Runtime>(app: &AppHandle<R>, update: StepUpdate) {
    if let Err(e) = app.emit(topic::STEP, update) {
        tracing::warn!("failed to emit step: {e}");
    }
}
