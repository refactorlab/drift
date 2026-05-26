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
use std::panic::AssertUnwindSafe;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;

use anyhow::{Context, Result};
use drift_static_profiler::{
    analyze_picked_with_progress, analyze_with_progress, AnalyzeOptions, AnalyzeOutcome,
    DiscoverOpts,
};
use tauri::{AppHandle, Emitter, Runtime};

use crate::app_config::ScanFilters;

use super::progress_sink::{CancelledByUser, TauriProgressSink};
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

    /// Send `None` if a picker is parked, otherwise no-op. Used by Stop —
    /// callers don't care whether the picker slot was active (we always also
    /// flip the cancel flag).
    fn cancel_if_parked(&self, scan_id: &str) {
        if let Some(tx) = self.take(scan_id) {
            let _ = tx.send(None);
        }
    }

    /// Resolve every parked picker with `None`. Used by the app's graceful
    /// shutdown path so any blocking scan task currently waiting on a
    /// picker decision unwinds immediately instead of hanging the process
    /// until the tokio runtime drops the channel.
    pub fn cancel_all(&self) {
        let drained: Vec<_> = match self.inner.lock() {
            Ok(mut g) => g.drain().collect(),
            Err(_) => return,
        };
        for (_, tx) in drained {
            let _ = tx.send(None);
        }
    }
}

/// Per-scan cancel flags, flipped by the Stop button. The progress sink
/// checks this on every callback and panics with [`CancelledByUser`] to
/// unwind the blocking analysis task — the only viable cancellation
/// strategy because `analyze_picked_with_progress` runs inside a rayon
/// parse loop with no native abort. The runner catches the panic and
/// converts it to a clean error event.
///
/// Why a separate registry from [`PickerRegistry`]: the picker channel
/// covers the parked-on-picker window only. Cancel needs to work in
/// every phase — walk, parse, graph build, tree build — and a long-lived
/// `Arc<AtomicBool>` shared with the sink is the cheapest way to do it.
#[derive(Default)]
pub struct ScanCancelRegistry {
    inner: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl ScanCancelRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Install a fresh cancel flag for `scan_id` and return it so the
    /// runner can hand it to the progress sink. The same `Arc` is held in
    /// the registry so [`Self::cancel`] can flip it from a different task.
    fn install(&self, scan_id: String) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        if let Ok(mut g) = self.inner.lock() {
            g.insert(scan_id, Arc::clone(&flag));
        }
        flag
    }

    /// Free the registry slot once the analysis task exits — success,
    /// error, or cancel. Without this the map would grow unbounded.
    fn clear(&self, scan_id: &str) {
        if let Ok(mut g) = self.inner.lock() {
            g.remove(scan_id);
        }
    }

    /// Set the cancel flag for `scan_id`. Returns true if a flag existed
    /// (i.e. there was a live scan), false otherwise. The flag is held by
    /// the progress sink, which polls it on every callback.
    pub fn cancel(&self, scan_id: &str) -> bool {
        let Ok(g) = self.inner.lock() else { return false };
        match g.get(scan_id) {
            Some(flag) => {
                flag.store(true, Ordering::SeqCst);
                true
            }
            None => false,
        }
    }

    /// Flip every registered cancel flag. The corresponding blocking scan
    /// tasks will unwind on their next progress callback. Returns the
    /// number of flags that were flipped, so callers can log how many
    /// in-flight scans were signalled.
    pub fn cancel_all(&self) -> usize {
        let Ok(g) = self.inner.lock() else { return 0 };
        for flag in g.values() {
            flag.store(true, Ordering::SeqCst);
        }
        g.len()
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
    picker_registry: Arc<PickerRegistry>,
    cancel_registry: Arc<ScanCancelRegistry>,
) {
    let app_for_task = app.clone();
    let scan_id_for_task = scan_id.clone();
    let pick_rx = picker_registry.install(scan_id.clone());
    let cancel_flag = cancel_registry.install(scan_id.clone());

    tracing::info!(
        scan_id = %scan_id,
        path = %project_path.display(),
        exclude_tests = filters.exclude_tests,
        exclude_static_assets = filters.exclude_static_assets,
        "scan kicked off (picker flow)"
    );

    tauri::async_runtime::spawn_blocking(move || {
        run_blocking(
            app_for_task,
            scan_id_for_task,
            project_path,
            filters,
            pick_rx,
            picker_registry,
            cancel_registry,
            cancel_flag,
        );
    });
}

/// Kick off a focused scan against a *specific* entry function, skipping the
/// discovery + picker handshake. Used by `restart_scan_from_cache` so the user
/// can pick a different entry from a prior scan's saved roots without paying
/// for re-discovery.
///
/// `picker_roots_seed` is the same list the source scan saved — we re-persist
/// it on the new scan's envelope so a subsequent "Pick another entry" works
/// against the new scan id symmetrically.
///
/// Walk + parse + graph build still happen (those are the structural inputs
/// the analyzer needs); only the roots-discovery phase + the user-picker
/// pause are bypassed.
pub fn start_scan_for_entry<R: Runtime>(
    app: AppHandle<R>,
    scan_id: String,
    project_path: PathBuf,
    filters: ScanFilters,
    entry_name: String,
    picker_roots_seed: Vec<ScanPickerRoot>,
    cancel_registry: Arc<ScanCancelRegistry>,
) {
    let app_for_task = app.clone();
    let scan_id_for_task = scan_id.clone();
    let cancel_flag = cancel_registry.install(scan_id.clone());

    tracing::info!(
        scan_id = %scan_id,
        path = %project_path.display(),
        entry = %entry_name,
        seed_roots = picker_roots_seed.len(),
        "scan kicked off (focused entry)"
    );

    tauri::async_runtime::spawn_blocking(move || {
        run_focused_blocking(
            app_for_task,
            scan_id_for_task,
            project_path,
            filters,
            entry_name,
            picker_roots_seed,
            cancel_registry,
            cancel_flag,
        );
    });
}

fn run_blocking<R: Runtime>(
    app: AppHandle<R>,
    scan_id: String,
    project_path: PathBuf,
    filters: ScanFilters,
    pick_rx: std::sync::mpsc::Receiver<Option<usize>>,
    picker_registry: Arc<PickerRegistry>,
    cancel_registry: Arc<ScanCancelRegistry>,
    cancel_flag: Arc<AtomicBool>,
) {
    let sink = TauriProgressSink::new(app.clone(), scan_id.clone(), Arc::clone(&cancel_flag));
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
    //
    // `captured_roots` keeps a clone of the decorated rows so the outer
    // `finalize` can persist them in the saved scan envelope. We need them
    // *after* the analyzer returns — the closure's borrowed `&[PickerRoot]`
    // is gone by then, so capture-on-call is the only path that works.
    let app_for_picker = app.clone();
    let scan_id_for_picker = scan_id.clone();
    let picker_invoked = Arc::new(AtomicBool::new(false));
    let picker_invoked_for_callback = Arc::clone(&picker_invoked);
    let captured_roots: Arc<Mutex<Vec<ScanPickerRoot>>> = Arc::new(Mutex::new(Vec::new()));
    let captured_roots_for_callback = Arc::clone(&captured_roots);
    let pick_callback = move |roots: &[drift_static_profiler::PickerRoot]| -> Option<usize> {
        picker_invoked_for_callback.store(true, Ordering::SeqCst);
        tracing::info!(
            scan_id = %scan_id_for_picker,
            roots = roots.len(),
            top_reach = roots.first().map(|r| r.reach).unwrap_or(0),
            "picker rows ready — awaiting user pick"
        );
        let decorated: Vec<ScanPickerRoot> = roots.iter().enumerate().map(decorate).collect();
        if let Ok(mut g) = captured_roots_for_callback.lock() {
            *g = decorated.clone();
        }
        let payload = ScanEntriesReady {
            scan_id: scan_id_for_picker.clone(),
            roots: decorated,
        };
        let _ = app_for_picker.emit(topic::ENTRIES_READY, payload);
        // Wait for the user. If the sender is dropped (cancelled), recv
        // returns Err — treat as abort.
        match pick_rx.recv() {
            Ok(choice) => {
                tracing::info!(
                    scan_id = %scan_id_for_picker,
                    choice = ?choice,
                    "picker decision received"
                );
                choice
            }
            Err(_) => {
                tracing::warn!(
                    scan_id = %scan_id_for_picker,
                    "picker channel closed without decision — treating as abort"
                );
                None
            }
        }
    };

    // The analysis runs on rayon worker threads with no native abort. Our
    // cancel path is the progress sink panicking with `CancelledByUser` —
    // rayon catches the panic and re-raises at the join point. `catch_unwind`
    // converts that into a value we can branch on without crashing the task.
    let result = std::panic::catch_unwind(AssertUnwindSafe(|| {
        analyze_picked_with_progress(
            &project_path,
            &discover,
            &opts,
            &sink,
            pick_callback,
        )
    }));

    // Free both registry slots so a follow-up scan can install fresh state.
    let _ = picker_registry.take(&scan_id);
    cancel_registry.clear(&scan_id);

    // Cancel-on-panic is the priority branch — even if rayon also produced
    // a noisy `Err(...)` while unwinding, the user's intent was Stop.
    if cancel_flag.load(Ordering::SeqCst)
        || matches!(&result, Err(p) if p.downcast_ref::<CancelledByUser>().is_some())
    {
        tracing::info!(scan_id = %scan_id, "scan stopped by user");
        let _ = app.emit(
            topic::ERROR,
            ScanError {
                scan_id,
                message: "scan stopped".to_string(),
            },
        );
        return;
    }

    match result {
        Ok(Ok(Some(outcome))) => {
            // Snapshot the captured roots out of the shared cell. The closure
            // has dropped by the time we get here, so this `take` is
            // single-owner — no contention with another writer.
            let roots = captured_roots
                .lock()
                .map(|g| g.clone())
                .unwrap_or_default();
            finalize(app, scan_id, outcome, roots);
        }
        Ok(Ok(None)) => {
            let message = if picker_invoked.load(Ordering::SeqCst) {
                // Closure ran → user closed the picker without selecting.
                "scan cancelled — no entry selected".to_string()
            } else {
                // Closure never ran → discovery returned an empty roots
                // list. Surface a real, actionable diagnostic instead of
                // the old catch-all.
                no_roots_diagnostic(&project_path, &filters)
            };
            tracing::warn!(
                scan_id = %scan_id,
                picker_invoked = picker_invoked.load(Ordering::SeqCst),
                "scan ended without outcome"
            );
            let _ = app.emit(
                topic::ERROR,
                ScanError {
                    scan_id,
                    message,
                },
            );
        }
        Ok(Err(e)) => {
            tracing::error!(scan_id = %scan_id, error = %e, "scan failed");
            let _ = app.emit(
                topic::ERROR,
                ScanError {
                    scan_id,
                    message: format!("{e:#}"),
                },
            );
        }
        Err(p) => {
            // Unrelated panic (not our cancel sentinel) — surface enough
            // for the UI to show, and let the process keep serving the
            // rest of the app.
            let msg = panic_message(p.as_ref());
            tracing::error!(scan_id = %scan_id, panic = %msg, "scan panicked");
            let _ = app.emit(
                topic::ERROR,
                ScanError {
                    scan_id,
                    message: format!("scan crashed: {msg}"),
                },
            );
        }
    }
}

/// Focused-scan body. Runs `analyze_with_progress` for a single entry name
/// — same walk/parse/graph build pipeline as the picker flow, but no
/// discovery pass and no picker pause. On success, persists with the seed
/// picker_roots so subsequent "switch entry" UX has a menu to render.
fn run_focused_blocking<R: Runtime>(
    app: AppHandle<R>,
    scan_id: String,
    project_path: PathBuf,
    filters: ScanFilters,
    entry_name: String,
    picker_roots_seed: Vec<ScanPickerRoot>,
    cancel_registry: Arc<ScanCancelRegistry>,
    cancel_flag: Arc<AtomicBool>,
) {
    let sink = TauriProgressSink::new(app.clone(), scan_id.clone(), Arc::clone(&cancel_flag));
    let opts = AnalyzeOptions {
        exclude_static_assets: filters.exclude_static_assets,
        exclude_tests: filters.exclude_tests,
        ..AnalyzeOptions::default()
    };
    let entries = vec![entry_name.clone()];

    let result = std::panic::catch_unwind(AssertUnwindSafe(|| {
        analyze_with_progress(&project_path, &entries, &opts, &sink)
    }));

    cancel_registry.clear(&scan_id);

    if cancel_flag.load(Ordering::SeqCst)
        || matches!(&result, Err(p) if p.downcast_ref::<CancelledByUser>().is_some())
    {
        let _ = app.emit(
            topic::ERROR,
            ScanError {
                scan_id,
                message: "scan stopped".to_string(),
            },
        );
        return;
    }

    match result {
        Ok(Ok(outcome)) => {
            // If the named entry didn't resolve to anything in the graph,
            // surface that as a real diagnostic rather than emitting a
            // success with an empty report (the suggester would then have
            // no findings and the user wouldn't know why).
            if outcome.report.entries.is_empty() {
                tracing::warn!(
                    scan_id = %scan_id,
                    entry = %entry_name,
                    "focused entry did not resolve in graph"
                );
                let _ = app.emit(
                    topic::ERROR,
                    ScanError {
                        scan_id,
                        message: format!(
                            "entry `{entry_name}` did not resolve in the current graph — \
                             the file may have changed since the source scan. Try `Rescan entirely`."
                        ),
                    },
                );
                return;
            }
            finalize(app, scan_id, outcome, picker_roots_seed);
        }
        Ok(Err(e)) => {
            tracing::error!(scan_id = %scan_id, error = %e, "focused scan failed");
            let _ = app.emit(
                topic::ERROR,
                ScanError {
                    scan_id,
                    message: format!("{e:#}"),
                },
            );
        }
        Err(p) => {
            let msg = panic_message(&p);
            tracing::error!(scan_id = %scan_id, panic = %msg, "focused scan panicked");
            let _ = app.emit(
                topic::ERROR,
                ScanError {
                    scan_id,
                    message: format!("scan crashed: {msg}"),
                },
            );
        }
    }
}

fn panic_message(p: &(dyn std::any::Any + Send)) -> String {
    if let Some(s) = p.downcast_ref::<String>() {
        s.clone()
    } else if let Some(s) = p.downcast_ref::<&'static str>() {
        (*s).to_string()
    } else {
        "unknown panic".to_string()
    }
}

/// Public entry-point used by the `stop_static_scan` Tauri command. Flips
/// the cancel flag (so the sink will panic on the next callback) AND sends
/// `None` through the picker channel (so a scan parked waiting for the
/// user's pick wakes up immediately).
///
/// Returns true if a live scan was found and signalled.
pub fn stop_scan(
    scan_id: &str,
    picker_registry: &PickerRegistry,
    cancel_registry: &ScanCancelRegistry,
) -> bool {
    // Unblock the picker first — `cancel` alone wouldn't wake a thread
    // sitting on `pick_rx.recv()`. Idempotent if no picker is parked.
    picker_registry.cancel_if_parked(scan_id);
    let was_live = cancel_registry.cancel(scan_id);
    tracing::info!(scan_id = %scan_id, was_live, "stop_scan requested");
    was_live
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

fn finalize<R: Runtime>(
    app: AppHandle<R>,
    scan_id: String,
    outcome: AnalyzeOutcome,
    picker_roots: Vec<ScanPickerRoot>,
) {
    let picked_root = outcome
        .report
        .entries
        .first()
        .map(|e| e.name.clone());

    match storage::save_report(&scan_id, &outcome.report, &picker_roots) {
        Ok(path) => {
            tracing::info!(
                scan_id = %scan_id,
                picked_root = picked_root.as_deref().unwrap_or("<none>"),
                entries = outcome.report.entries.len(),
                symbols = outcome.report.summary.symbols,
                saved_path = %path.display(),
                "scan complete"
            );
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
            tracing::error!(scan_id = %scan_id, error = %e, "save report failed");
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

#[cfg(test)]
mod cancel_all_tests {
    //! Coverage for the `cancel_all` helpers the app's graceful shutdown
    //! path depends on. Without this, regressions in the registries could
    //! silently leak in-flight scans on quit.

    use super::*;

    #[test]
    fn scan_cancel_registry_flips_every_flag() {
        let reg = ScanCancelRegistry::new();
        let f1 = reg.install("a".into());
        let f2 = reg.install("b".into());
        assert!(!f1.load(Ordering::SeqCst));
        assert!(!f2.load(Ordering::SeqCst));

        assert_eq!(reg.cancel_all(), 2);
        assert!(f1.load(Ordering::SeqCst));
        assert!(f2.load(Ordering::SeqCst));
    }

    #[test]
    fn picker_registry_resolves_parked_waiters_with_none() {
        let reg = PickerRegistry::new();
        let rx = reg.install("scan-1".into());

        reg.cancel_all();

        // The parked task wakes with `None` (the abort sentinel) rather
        // than hanging on `recv()` forever.
        let choice = rx.recv().expect("picker channel should resolve");
        assert!(choice.is_none());
    }
}
