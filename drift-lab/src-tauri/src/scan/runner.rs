//! Two-step static-scan orchestrator.
//!
//! Flow:
//!   1. UI calls `start_scan(project_path)` → we spawn a blocking task that
//!      runs `analyze_picked_with_progress`. While discovery is in flight,
//!      progress events stream over `scan://progress`.
//!   2. When discovery hits the picker step, the closure emits
//!      `scan://entries-ready` and **parks** on a per-scan oneshot. The UI
//!      shows the user the top-N roots.
//!   3. UI calls `select_entry(scan_id, root_index)`. We send through the
//!      oneshot — the blocking task wakes, builds the focused call tree,
//!      assembles the Report, persists it to `~/.drift/scans/<id>.json`,
//!      and emits `scan://complete`.
//!
//! The `PickerRegistry` is the single owner of the per-scan decision senders.
//! Holding it in `AppState` keeps the blocking analysis task decoupled from
//! Tauri commands — the runner doesn't know about commands, the commands
//! don't know about `analyze_picked_with_progress`.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;

use anyhow::{Context, Result};
use drift_static_profiler::{
    analyze_picked_with_progress, AnalyzeOptions, AnalyzeOutcome, DiscoverOpts,
};
use tauri::{AppHandle, Emitter, Runtime};

use crate::app_config::ScanFilters;

use super::progress_sink::TauriProgressSink;
use super::storage;
use super::types::{
    topic, ScanComplete, ScanEntriesReady, ScanError, ScanPickerCaller, ScanPickerRoot,
};

/// Maximum number of root entries we surface in the picker.
///
/// The UI shows the top 10 by reach by default and supports inline
/// filtering over the full pool — so the backend's job is to deliver
/// "everything the user could plausibly want to search through", not
/// just the visible default slice. 200 is a generous ceiling:
///   - The static analyzer ranks by reach, so the first 200 are the
///     genuinely-relevant entry candidates on any realistic project.
///   - Serialized payload stays well under 50 kB for 200 rows × ~250 B,
///     trivial over Tauri's IPC.
///   - Pathological codebases with tens of thousands of entry candidates
///     don't waste IPC bandwidth or render a useless 10k-row dropdown.
///
/// If a project routinely needs more than 200, the right fix is a
/// server-side fetch-on-search endpoint, not raising this constant.
const PICKER_LIMIT: usize = 200;

/// Per-scan handshake state. Holds the channel the analysis closure parks
/// on while the user picks an entry from the UI. One slot per in-flight
/// `scan_id`.
#[derive(Default)]
pub struct PickerRegistry {
    inner: Mutex<HashMap<String, std::sync::mpsc::SyncSender<Option<usize>>>>,
}

impl PickerRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    fn install(&self, scan_id: String) -> std::sync::mpsc::Receiver<Option<usize>> {
        let (tx, rx) = std::sync::mpsc::sync_channel::<Option<usize>>(1);
        // Last-writer-wins for the same scan_id is fine — a fresh
        // start_scan with the same id (shouldn't happen since we generate
        // UUIDs) would just shadow the previous handshake.
        if let Ok(mut g) = self.inner.lock() {
            g.insert(scan_id, tx);
        }
        rx
    }

    fn take(&self, scan_id: &str) -> Option<std::sync::mpsc::SyncSender<Option<usize>>> {
        self.inner.lock().ok()?.remove(scan_id)
    }

    /// Forward the user's decision into the parked analysis closure.
    /// `Some(index)` builds the call tree for that root, `None` aborts.
    pub fn decide(&self, scan_id: &str, choice: Option<usize>) -> Result<()> {
        let tx = self
            .take(scan_id)
            .with_context(|| format!("no pending picker for scan {scan_id}"))?;
        tx.send(choice)
            .context("picker decision channel closed — analysis task exited")?;
        Ok(())
    }
}

/// Kick off a static scan. Returns immediately; results stream over events.
///
/// The blocking `analyze_picked_with_progress` call runs on Tokio's blocking
/// pool so the async runtime stays responsive.
pub fn start_scan<R: Runtime>(
    app: AppHandle<R>,
    scan_id: String,
    project_path: PathBuf,
    filters: ScanFilters,
    registry: Arc<PickerRegistry>,
) {
    let app_for_task = app.clone();
    let scan_id_for_task = scan_id.clone();
    let pick_rx = registry.install(scan_id.clone());

    tauri::async_runtime::spawn_blocking(move || {
        run_blocking(
            app_for_task,
            scan_id_for_task,
            project_path,
            filters,
            pick_rx,
            registry,
        );
    });
}

fn run_blocking<R: Runtime>(
    app: AppHandle<R>,
    scan_id: String,
    project_path: PathBuf,
    filters: ScanFilters,
    pick_rx: std::sync::mpsc::Receiver<Option<usize>>,
    registry: Arc<PickerRegistry>,
) {
    let sink = TauriProgressSink::new(app.clone(), scan_id.clone());
    let discover = DiscoverOpts {
        max_roots: PICKER_LIMIT,
        ..DiscoverOpts::default()
    };
    // Translate user-facing scan filters into the profiler's AnalyzeOptions.
    // Single point of mapping — if a new ScanFilters field is added, it gets
    // a corresponding override here. Everything else inherits `default()`.
    //
    // exclude_tests is forwarded because a heavyweight test bundle (e.g. a
    // 10MB vite-built `*.test.js`) can otherwise flip the dominant-language
    // pick away from the application's real source files — the picker then
    // returns zero candidate roots and the UI bottoms out on a generic
    // "no entry selected" error with no actionable signal.
    let opts = AnalyzeOptions {
        exclude_static_assets: filters.exclude_static_assets,
        exclude_tests: filters.exclude_tests,
        ..AnalyzeOptions::default()
    };

    // `pick_callback` runs synchronously on the blocking task. It emits the
    // picker rows then blocks on the registry channel until the UI sends
    // through `select_entry_and_scan(scan_id, index)`.
    //
    // `picker_invoked` lets the outer match disambiguate `Ok(None)` after
    // the call: if it was set, the closure ran and the user picked nothing
    // (cancel); if it stayed false, discovery yielded zero roots and the
    // closure was never called. Two very different failure modes that the
    // old error message conflated — the UI now gets a real reason.
    let app_for_picker = app.clone();
    let scan_id_for_picker = scan_id.clone();
    let picker_invoked = Arc::new(AtomicBool::new(false));
    let picker_invoked_for_callback = Arc::clone(&picker_invoked);
    let pick_callback = move |roots: &[drift_static_profiler::PickerRoot]| -> Option<usize> {
        picker_invoked_for_callback.store(true, Ordering::SeqCst);
        let payload = ScanEntriesReady {
            scan_id: scan_id_for_picker.clone(),
            roots: roots.iter().enumerate().map(decorate).collect(),
        };
        let _ = app_for_picker.emit(topic::ENTRIES_READY, payload);
        // Wait for the user. If the sender is dropped (cancelled), recv
        // returns Err — treat as abort.
        match pick_rx.recv() {
            Ok(choice) => choice,
            Err(_) => None,
        }
    };

    let result = analyze_picked_with_progress(
        &project_path,
        &discover,
        &opts,
        &sink,
        pick_callback,
    );

    // Ensure the registry slot is freed even if the closure short-circuited
    // before recv (e.g. discovery returned no roots).
    let _ = registry.take(&scan_id);

    match result {
        Ok(Some(outcome)) => finalize(app, scan_id, outcome),
        Ok(None) => {
            let message = if picker_invoked.load(Ordering::SeqCst) {
                // Closure ran → user closed the picker without selecting.
                "scan cancelled — no entry selected".to_string()
            } else {
                // Closure never ran → discovery returned an empty roots
                // list. Surface a real, actionable diagnostic instead of
                // the old catch-all.
                no_roots_diagnostic(&project_path, &filters)
            };
            let _ = app.emit(
                topic::ERROR,
                ScanError {
                    scan_id,
                    message,
                },
            );
        }
        Err(e) => {
            let _ = app.emit(
                topic::ERROR,
                ScanError {
                    scan_id,
                    message: format!("{e:#}"),
                },
            );
        }
    }
}

/// Build a real "why did discovery return zero?" message that the UI can
/// surface to the user. The desktop fail-fast philosophy: if we hit this
/// branch, name the concrete reason and point at the lever to flip,
/// not "no entry selected or no roots discovered" (which is what triggered
/// this whole investigation).
///
/// We list the currently-applied walker filters so the user sees which
/// ones might be over-eagerly hiding their code, and we point them at
/// the CLI debug companion (`make scan-prompt-entries`) for the
/// authoritative same-filters list.
fn no_roots_diagnostic(project_path: &std::path::Path, filters: &ScanFilters) -> String {
    let mut applied = Vec::new();
    if filters.exclude_static_assets {
        applied.push("static/assets dirs");
    }
    if filters.exclude_tests {
        applied.push("test/spec/mock files");
    }
    let filters_line = if applied.is_empty() {
        "no walker filters currently applied".to_string()
    } else {
        format!("currently filtering: {}", applied.join(", "))
    };
    format!(
        "no entry roots discovered in {}.\n\n{filters_line}.\n\n\
         next steps:\n\
         • run `make scan-prompt-entries {}` to print the full discovery list \
         under the same filters\n\
         • try Settings → Scanning to toggle filters off if your project \
         really keeps source under static/assets/ or tests/",
        project_path.display(),
        project_path.display(),
    )
}

fn finalize<R: Runtime>(app: AppHandle<R>, scan_id: String, outcome: AnalyzeOutcome) {
    let picked_root = outcome
        .report
        .entries
        .first()
        .map(|e| e.name.clone());

    match storage::save_report(&scan_id, &outcome.report) {
        Ok(path) => {
            let _ = app.emit(
                topic::COMPLETE,
                ScanComplete {
                    scan_id,
                    saved_path: path.display().to_string(),
                    picked_root,
                },
            );
        }
        Err(e) => {
            let _ = app.emit(
                topic::ERROR,
                ScanError {
                    scan_id,
                    message: format!("saving scan: {e:#}"),
                },
            );
        }
    }
}

fn decorate((index, r): (usize, &drift_static_profiler::PickerRoot)) -> ScanPickerRoot {
    ScanPickerRoot {
        index,
        name: r.name.clone(),
        file: r.file.clone(),
        line: r.line,
        reach: r.reach,
        callers: r
            .callers
            .iter()
            .map(|c| ScanPickerCaller {
                name: c.name.clone(),
                file: c.file.clone(),
                line: c.line,
            })
            .collect(),
    }
}
