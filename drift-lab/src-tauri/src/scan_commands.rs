//! Tauri commands that bridge the desktop UI to `crate::scan`.
//!
//! Split out of `commands.rs` so the static-scan lifecycle reads as one
//! concise unit. Each command is a thin shim — it parses Tauri args, calls
//! into `scan::runner` / `scan::storage` / `scan::suggester`, and returns.
//! No business logic lives here.

use std::path::PathBuf;
use std::sync::Arc;

use tauri::{AppHandle, Runtime, State};
use uuid::Uuid;

use crate::model_config::ModelBackend;
use crate::scan::{runner, storage, suggester, types::ScanPickerRoot};
use crate::state::AppState;

/// Kick off a static scan and return its `scan_id` immediately. Progress
/// events stream over `scan://progress`; the picker fires
/// `scan://entries-ready` and parks until [`select_entry_and_scan`] is
/// called.
#[tauri::command]
pub async fn start_static_scan<R: Runtime>(
    project_path: String,
    state: State<'_, AppState>,
    app: AppHandle<R>,
) -> Result<String, String> {
    let path = PathBuf::from(&project_path);
    if !path.is_dir() {
        return Err(format!("not a directory: {project_path}"));
    }
    let scan_id = Uuid::new_v4().to_string();
    // Snapshot the user's scan-filter preferences at scan kick-off — the
    // settings UI can be opened/changed mid-scan without affecting the run
    // already in flight. Settings UI users see "next scan will use new
    // filters" semantics, which matches how the wire contract is documented.
    let filters = state.app_config.lock().await.scan_filters;
    runner::start_scan(
        app,
        scan_id.clone(),
        path,
        filters,
        Arc::clone(&state.scan_pickers),
        Arc::clone(&state.scan_cancels),
    );
    Ok(scan_id)
}

/// Stop an in-flight static scan. Idempotent — silently no-ops if no scan
/// is running with the given id (returns `false`).
///
/// Mechanism: flip the cancel flag in the registry. The progress sink polls
/// it on every callback (walk, parse, graph, tree build) and panics with
/// `CancelledByUser` to unwind the rayon-driven analysis pipeline. We also
/// send `None` through the picker channel so a scan parked waiting for the
/// user's pick wakes up immediately rather than after the first post-pick
/// progress callback.
#[tauri::command]
pub async fn stop_static_scan(
    scan_id: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    Ok(runner::stop_scan(
        &scan_id,
        state.scan_pickers.as_ref(),
        state.scan_cancels.as_ref(),
    ))
}

/// Deliver the user's picker choice. `root_index` is the row index from the
/// `ScanEntriesReady` payload (or `None` to cancel the scan cleanly).
#[tauri::command]
pub async fn select_entry_and_scan(
    scan_id: String,
    root_index: Option<usize>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .scan_pickers
        .decide(&scan_id, root_index)
        .map_err(|e| format!("{e:#}"))
}

/// Re-run the focused profile against a *different* entry from a prior
/// scan's cached picker-root list — no re-discovery, no picker pause.
///
/// Returns the new `scan_id` immediately; progress streams over the same
/// `scan://progress` channel the live scan uses. The new scan also gets the
/// same `picker_roots` cached on its envelope, so the user can keep
/// switching entries against the same candidate set.
///
/// `source_scan_id` identifies the saved scan whose cached roots + project
/// path we draw from. `root_index` indexes into that scan's
/// `picker_roots`. The project root comes from the source scan's
/// `report.generator.source_root`, which is the path the original scan was
/// run against.
#[tauri::command]
pub async fn restart_scan_from_cache<R: Runtime>(
    source_scan_id: String,
    root_index: usize,
    state: State<'_, AppState>,
    app: AppHandle<R>,
) -> Result<String, String> {
    let env = storage::load_envelope(&source_scan_id).map_err(|e| format!("{e:#}"))?;
    if env.picker_roots.is_empty() {
        return Err(
            "this scan was saved before picker_roots were cached — run `Rescan entirely` first to populate the cache"
                .to_string(),
        );
    }
    let picked = env
        .picker_roots
        .get(root_index)
        .ok_or_else(|| format!("root_index {root_index} out of range"))?
        .clone();
    let project_path = env
        .report
        .generator
        .source_root
        .clone()
        .ok_or_else(|| "source scan has no recorded source_root".to_string())?;
    let path = PathBuf::from(&project_path);
    if !path.is_dir() {
        return Err(format!(
            "project root no longer a directory: {project_path}"
        ));
    }

    let scan_id = Uuid::new_v4().to_string();
    let filters = state.app_config.lock().await.scan_filters;
    runner::start_scan_for_entry(
        app,
        scan_id.clone(),
        path,
        filters,
        picked.name.clone(),
        env.picker_roots,
        Arc::clone(&state.scan_cancels),
    );
    Ok(scan_id)
}

/// List every saved scan under `~/.drift/scans/`. Sorted by saved_at desc.
#[tauri::command]
pub async fn list_static_scans() -> Result<Vec<storage::ScanMeta>, String> {
    storage::list_scans().map_err(|e| format!("{e:#}"))
}

/// Return a previously-saved scan envelope (scan_id + saved_at + Report).
#[tauri::command]
pub async fn load_static_scan(scan_id: String) -> Result<storage::StoredScan, String> {
    storage::load_envelope(&scan_id).map_err(|e| format!("{e:#}"))
}

/// Return a previously-saved scan envelope **without** each entry's
/// recursive `children` subtree. The summary + entry headers are enough
/// to render the landing dashboard for any scan; the actual per-entry
/// call tree is fetched lazily via [`load_scan_entry`] when the user
/// drills in.
///
/// Sized for browser / IPC ergonomics: typical summary is KB-tens-of-KB,
/// while a full envelope on a real project can be 50–500 MB.
#[tauri::command]
pub async fn load_static_scan_summary(
    scan_id: String,
) -> Result<storage::StoredScan, String> {
    storage::load_envelope_summary(&scan_id).map_err(|e| format!("{e:#}"))
}

/// Return the full `CallTreeNode` (with `children` populated recursively)
/// for one entry of a saved scan, indexed by 0-based position in the
/// envelope's `entries` array. Out-of-range surfaces as a clean error
/// that the UI can show inline.
#[tauri::command]
pub async fn load_scan_entry(
    scan_id: String,
    entry_index: usize,
) -> Result<drift_static_profiler::tree::CallTreeNode, String> {
    storage::load_scan_entry(&scan_id, entry_index).map_err(|e| format!("{e:#}"))
}

/// Delete a saved scan from `~/.drift/scans/`. Best-effort: any per-finding
/// suggestion driver still running for this scan is cancelled first so it
/// can't re-create the file we're about to remove. Idempotent — deleting
/// a non-existent scan returns `Ok(())`.
#[tauri::command]
pub async fn delete_static_scan(
    scan_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Cancel any per-finding suggestion drivers writing to this scan so a
    // racing save can't recreate the file. cancel_all_for_scan returns
    // quickly — the drivers' `tokio::select!` arms on the cancel token
    // and unwinds on their own thread.
    state.scan_suggestions.cancel_all_for_scan(&scan_id);
    storage::delete_scan(&scan_id).map_err(|e| format!("{e:#}"))
}

/// Return only the picker-style root list from a previously-saved scan —
/// useful when the UI wants to re-render the entry picker without parsing
/// the whole call-tree payload.
#[tauri::command]
pub async fn list_scan_entries(scan_id: String) -> Result<Vec<ScanPickerRoot>, String> {
    let env = storage::load_envelope(&scan_id).map_err(|e| format!("{e:#}"))?;
    Ok(env
        .report
        .entries
        .iter()
        .enumerate()
        .map(|(i, e)| ScanPickerRoot {
            index: i,
            name: e.name.clone(),
            file: e.file.clone(),
            line: e.line,
            reach: e.subtree_size,
            callers: e
                .callers
                .iter()
                .map(|c| crate::scan::types::ScanPickerCaller {
                    name: c.name.clone(),
                    file: c.file.clone(),
                    line: c.line,
                })
                .collect(),
        })
        .collect())
}

/// Return every persisted "Study this" suggestion for `scan_id`. Used by
/// the report page on mount to re-hydrate the suggestion rows from disk —
/// the user's prior LLM output survives reloads and re-navigations without
/// re-running the model.
///
/// Returns an empty list (not an error) when the scan exists but has never
/// had a Study This clicked on it. The frontend treats both shapes the
/// same: no rows pre-populated, all buttons in their idle "Study this"
/// state.
#[tauri::command]
pub async fn list_saved_suggestions(
    scan_id: String,
) -> Result<Vec<storage::SavedSuggestion>, String> {
    storage::list_saved_suggestions(&scan_id).map_err(|e| format!("{e:#}"))
}

/// Return EVERY version persisted for one finding, newest first. Used by
/// the per-row "version history" picker — the user can swap the visible
/// body back to a prior version without re-running the model.
///
/// `scan_id` + `index` identify the finding. Returns an empty list if
/// the finding has never been studied (no on-disk history yet).
#[tauri::command]
pub async fn list_suggestion_versions(
    scan_id: String,
    index: usize,
) -> Result<Vec<storage::SavedSuggestion>, String> {
    storage::list_suggestion_versions(&scan_id, index).map_err(|e| format!("{e:#}"))
}

/// Return the canonical ranked + deduped finding list for a saved scan.
/// The frontend renders one "Study this" row per item; the `index` is the
/// key the UI passes back to [`start_scan_finding_suggestion`].
///
/// Why we expose this from Rust instead of having the UI compute it: the
/// suggester applies a specific dedupe (file, line, kind) and a hard cap on
/// the count. Keeping that policy in one place means the index the UI hands
/// us always matches the row the suggester will operate on.
#[tauri::command]
pub async fn list_scan_findings(scan_id: String) -> Result<Vec<suggester::FindingItem>, String> {
    let env = storage::load_envelope(&scan_id).map_err(|e| format!("{e:#}"))?;
    Ok(suggester::collect_findings(&env.report))
}

/// Kick off the LLM suggestion run for ONE finding in a saved scan. The
/// command returns immediately; the suggestion streams over
/// `scan://suggestion-{start,delta}` and terminates with
/// `scan://suggestion-done`.
///
/// **Idempotent per (scan_id, index)**: if a driver is already running for
/// this specific finding, we return `Ok(())` without spawning a duplicate
/// task. The user can still click Study This on a *different* finding while
/// another stream is in flight — each gets its own cancel token.
#[tauri::command]
pub async fn start_scan_finding_suggestion<R: Runtime>(
    scan_id: String,
    index: usize,
    state: State<'_, AppState>,
    app: AppHandle<R>,
) -> Result<(), String> {
    let config = state
        .config
        .lock()
        .await
        .clone()
        .ok_or_else(|| "backend not configured".to_string())?;
    let provider = build_provider(config).map_err(|e| format!("{e:#}"))?;
    let Some(cancel) = state
        .scan_suggestions
        .register_if_absent(&scan_id, index)
    else {
        return Ok(());
    };
    suggester::start_finding_suggestion(
        app,
        scan_id,
        index,
        provider,
        cancel,
        Arc::clone(&state.scan_suggestions),
    );
    Ok(())
}

/// Stop the in-flight suggestion driver for `(scan_id, index)`. Idempotent
/// — calling for a finding with no live session is a silent no-op
/// (returns `false`).
///
/// Mechanism: trigger the `CancellationToken` in the registry. The driver's
/// `tokio::select!` on `cancel.cancelled()` fires immediately, dropping the
/// provider stream future, which drops the underlying HTTP connection. The
/// driver finalizes the row (emits `scan://suggestion` so the UI clears
/// `isStreaming`) and emits `scan://suggestion-done`.
#[tauri::command]
pub async fn stop_scan_finding_suggestion(
    scan_id: String,
    index: usize,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    Ok(state.scan_suggestions.cancel(&scan_id, index))
}

fn build_provider(
    config: ModelBackend,
) -> anyhow::Result<Arc<dyn crate::agent::provider::Provider>> {
    Ok(crate::agent::make_provider(config))
}
