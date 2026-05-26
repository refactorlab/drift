//! `drift_static_profiler::Progress` implementation that forwards each
//! callback to a Tauri `AppHandle` as a `ScanProgress` event.
//!
//! Why a dedicated impl: the profiler doesn't know about Tauri (correctly so —
//! `Progress` is the seam between library and any UI). We provide the seam
//! implementation here so `analyze_picked_with_progress(..., &sink)` streams
//! live phase events into the desktop frontend with zero extra coupling on
//! the profiler side.
//!
//! Throttling: rayon's parse loop can call `parse_progress` thousands of
//! times per second. Emitting one Tauri event per call would saturate the IPC
//! channel and the UI render thread. We keep a per-phase
//! `last_emit_at: Instant` plus a coarser per-event-kind interval; the heavy
//! callbacks (`parse_progress`, `step_progress`) are rate-limited to
//! ~30 events/sec, while edge events (`*_start`, `*_end`, atomic `phase`) go
//! through immediately.
//!
//! Naming follows the trait verbs verbatim — `walk_start` on the trait emits
//! `ScanProgress::WalkStart` on the wire — so the frontend handler reads
//! exactly like the Rust progress contract.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use drift_static_profiler::Progress;
use tauri::{AppHandle, Emitter, Runtime};

use super::types::{topic, ScanProgress};

/// Panic payload the sink raises when its cancel flag flips. The runner's
/// `catch_unwind` arm downcasts on this concrete type so it can distinguish
/// "user pressed Stop" from a real crash and emit the right event. Empty
/// marker struct — the discriminator is the type, not a field.
pub struct CancelledByUser;

/// Same hint the CLI's tqdm-style bar uses (`drift_static_profiler::progress::
/// PIPELINE_PHASES_HINT`). Re-stating it here keeps the desktop "overall" bar
/// visually aligned with the CLI without coupling the wire contract to a
/// constant we don't re-export.
const PIPELINE_PHASES_HINT: u64 = 28;

/// Minimum gap between two consecutive throttled emissions per phase. Any
/// `parse_progress` / `step_progress` call within this window is dropped on
/// the floor; edges (`*_start`, `*_end`, atomic `phase`) always go through.
const THROTTLE: Duration = Duration::from_millis(33);

pub struct TauriProgressSink<R: Runtime> {
    app: AppHandle<R>,
    scan_id: String,
    /// Last emit time for the *throttled* events. We deliberately don't
    /// throttle edge events — the user wants to see phase transitions
    /// immediately, otherwise the icon column lags behind the work.
    last: Mutex<Instant>,
    /// Active step label, captured from `step_start`. Used as the `label`
    /// field on `StepProgress` events so the UI doesn't need to remember
    /// which phase the counter belongs to.
    active_step: Mutex<Option<String>>,
    /// Most recently announced "current item" — propagated to the next
    /// `parse_progress` / `step_progress` event. The profiler emits
    /// `set_current` thread-locally; the frontend wants it inline with the
    /// counted event so it lands in the same UI row.
    current_item: Mutex<Option<String>>,
    /// Wall-clock origin used to stamp `Overall { elapsed_ms }`. Set when
    /// the sink is constructed (right before the analyzer is invoked).
    started_at: Instant,
    /// Monotonically increasing pipeline phase counter. Bumped on every
    /// boundary callback (`walk_start`, `parse_start`, `phase`, `step_start`)
    /// so the UI can render "phase X / N" like the CLI's overall bar.
    phase_idx: AtomicU64,
    /// User-pressed-Stop flag, shared with `ScanCancelRegistry` in `runner`.
    /// Polled on every callback via [`Self::check_cancel`]; when set we
    /// `panic!(CancelledByUser)` to unwind the rayon-driven analysis
    /// pipeline. This is the only viable abort path because
    /// `analyze_picked_with_progress` has no native cancellation.
    cancel: Arc<AtomicBool>,
}

impl<R: Runtime> TauriProgressSink<R> {
    pub fn new(app: AppHandle<R>, scan_id: String, cancel: Arc<AtomicBool>) -> Self {
        Self {
            app,
            scan_id,
            last: Mutex::new(Instant::now() - THROTTLE),
            active_step: Mutex::new(None),
            current_item: Mutex::new(None),
            started_at: Instant::now(),
            phase_idx: AtomicU64::new(0),
            cancel,
        }
    }

    fn emit(&self, ev: ScanProgress) {
        let _ = self.app.emit(topic::PROGRESS, ev);
    }

    /// Single bail-point invoked at the top of every `Progress` callback.
    /// Cheap (one relaxed atomic load on the hot parse-loop path); when
    /// the flag is set, panics with `CancelledByUser` to unwind the
    /// analysis stack. The runner's `catch_unwind` then converts the
    /// panic into a clean "scan stopped" event.
    #[inline]
    fn check_cancel(&self) {
        if self.cancel.load(Ordering::Relaxed) {
            std::panic::panic_any(CancelledByUser);
        }
    }

    /// Bump the phase counter and emit an `Overall` heartbeat. Called from
    /// every phase-boundary callback (walk/parse/phase/step start). The
    /// returned index is 1-based so the UI reads "phase 1 of 28" on the
    /// very first boundary.
    fn bump_phase(&self) {
        let n = self.phase_idx.fetch_add(1, Ordering::Relaxed) + 1;
        self.emit(ScanProgress::Overall {
            scan_id: self.scan_id.clone(),
            phase_index: n,
            phase_total_hint: PIPELINE_PHASES_HINT,
            elapsed_ms: self.started_at.elapsed().as_millis() as u64,
        });
    }

    /// Decide whether the next throttled callback should actually emit. We
    /// always allow the final tick (`done == total`) through so the bar
    /// reaches 100% even when the throttle would have suppressed it.
    fn allow_throttled(&self, is_final: bool) -> bool {
        if is_final {
            return true;
        }
        let mut last = match self.last.lock() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        if last.elapsed() >= THROTTLE {
            *last = Instant::now();
            true
        } else {
            false
        }
    }

    fn take_current(&self) -> Option<String> {
        self.current_item.lock().ok().and_then(|mut g| g.take())
    }
}

impl<R: Runtime> Progress for TauriProgressSink<R> {
    fn walk_start(&self) {
        self.check_cancel();
        self.bump_phase();
        tracing::debug!(scan_id = %self.scan_id, "phase: walk_start");
        self.emit(ScanProgress::WalkStart { scan_id: self.scan_id.clone() });
    }

    fn walk_progress(&self, total: usize) {
        self.check_cancel();
        if !self.allow_throttled(false) {
            return;
        }
        self.emit(ScanProgress::WalkProgress {
            scan_id: self.scan_id.clone(),
            files_seen: total as u64,
        });
    }

    fn walk_end(&self, total_files: usize, bytes: u64) {
        self.check_cancel();
        tracing::debug!(
            scan_id = %self.scan_id,
            files = total_files,
            bytes,
            "phase: walk_end"
        );
        self.emit(ScanProgress::WalkEnd {
            scan_id: self.scan_id.clone(),
            total_files: total_files as u64,
            bytes,
        });
    }

    fn parse_start(&self, total: usize) {
        self.check_cancel();
        self.bump_phase();
        tracing::debug!(
            scan_id = %self.scan_id,
            files = total,
            "phase: parse_start"
        );
        self.emit(ScanProgress::ParseStart {
            scan_id: self.scan_id.clone(),
            total_source_files: total as u64,
        });
    }

    fn parse_progress(&self, done: usize, total: usize) {
        self.check_cancel();
        if !self.allow_throttled(done == total) {
            return;
        }
        self.emit(ScanProgress::ParseProgress {
            scan_id: self.scan_id.clone(),
            done: done as u64,
            total: total as u64,
            current: self.take_current(),
        });
    }

    fn phase(&self, name: &str) {
        self.check_cancel();
        // A new atomic phase implicitly closes any active counted step.
        if let Ok(mut g) = self.active_step.lock() {
            *g = None;
        }
        self.bump_phase();
        // Sink-level phase ticks are kept at debug — the library itself
        // already emits structured info-level logs at the canonical
        // boundaries (walk start/end, parse start/end, graph build
        // start/end, etc.), so info would just duplicate them. Leaving
        // this at debug means a `DRIFT_LOG=debug` run shows the full
        // ~28-phase trace, while default production logs stay quiet.
        tracing::debug!(
            scan_id = %self.scan_id,
            elapsed_ms = self.started_at.elapsed().as_millis() as u64,
            phase = %name,
            "phase"
        );
        self.emit(ScanProgress::Phase {
            scan_id: self.scan_id.clone(),
            name: name.to_string(),
        });
    }

    fn step_start(&self, label: &str, total: usize) {
        self.check_cancel();
        if let Ok(mut g) = self.active_step.lock() {
            *g = Some(label.to_string());
        }
        self.bump_phase();
        tracing::debug!(
            scan_id = %self.scan_id,
            elapsed_ms = self.started_at.elapsed().as_millis() as u64,
            step = %label,
            total,
            "step start"
        );
        self.emit(ScanProgress::StepStart {
            scan_id: self.scan_id.clone(),
            label: label.to_string(),
            total: total as u64,
        });
    }

    fn step_progress(&self, done: usize, total: usize) {
        self.check_cancel();
        if !self.allow_throttled(done == total) {
            return;
        }
        let label = self
            .active_step
            .lock()
            .ok()
            .and_then(|g| g.clone())
            .unwrap_or_default();
        self.emit(ScanProgress::StepProgress {
            scan_id: self.scan_id.clone(),
            label,
            done: done as u64,
            total: total as u64,
            current: self.take_current(),
        });
    }

    fn set_current(&self, item: &str) {
        self.check_cancel();
        if let Ok(mut g) = self.current_item.lock() {
            *g = Some(item.to_string());
        }
    }
}
