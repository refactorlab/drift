//! Process-wide graceful shutdown orchestrator.
//!
//! Triggered from the tray "Quit" menu and from Tauri's `ExitRequested`
//! run-event. Single source of truth so every quit path (Cmd+Q, tray,
//! WindowEvent::Destroyed) walks the same sequence:
//!
//!   1. **Arm the doomsday timer** — a detached tokio task that
//!      `process::exit`s after [`HARD_DEADLINE`], independent of every
//!      cooperative step below. Even if `shutdown::run` itself wedges on a
//!      poisoned mutex or a panicked subtask, the process is guaranteed
//!      to terminate within the deadline. This is the bullet-proof leg.
//!   2. Cancel every cooperative cancellation token / flag the app owns:
//!      the active chat / agent (`state.cancel_token`), every per-finding
//!      "Study this" stream (`scan_suggestions`), every static-scan flag
//!      (`scan_cancels`), and resolve any parked pickers with `None`.
//!   3. Fire the process-wide shutdown token so the bundled axum HTTP
//!      server breaks out of `with_graceful_shutdown`.
//!   4. Close the SQLite pool (flushes the WAL).
//!   5. The whole cooperative body is wrapped in
//!      `tokio::time::timeout(SHUTDOWN_DEADLINE, ...)`, so the function
//!      returns within five seconds even when a sub-step hangs — the
//!      caller's `process::exit(0)` then wins the race against the
//!      doomsday timer at eight seconds.
//!
//! Returns once shutdown is "done enough"; the caller is expected to
//! `std::process::exit(0)` immediately after. If the caller fails to do
//! so within [`HARD_DEADLINE`] from the start of `run`, the doomsday
//! timer takes over and kills the process unconditionally.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Manager, Runtime};
use tracing::{info, warn};

use crate::state::AppState;

/// Conventional exit code for "killed by SIGINT" on Unix (128 + signal
/// number). Used by the double-press escape hatch so shell pipelines that
/// inspect `$?` see the same code they'd see from a default-handler kill.
const FORCE_QUIT_EXIT_CODE: i32 = 130;

/// Conventional exit code for "killed by SIGKILL" on Unix (128 + 9). Used
/// by the doomsday timer when cooperative shutdown wedges past the hard
/// deadline. Distinct from [`FORCE_QUIT_EXIT_CODE`] so post-mortem logs
/// can tell "user double-pressed Ctrl+C" apart from "the app itself
/// failed to drain in time".
const DOOMSDAY_EXIT_CODE: i32 = 137;

/// How long we wait for cooperative shutdown before bailing out. Five
/// seconds is enough for the HTTP server's `with_graceful_shutdown` to
/// finish draining in-flight responses and for the SQLite pool to flush
/// its WAL, but short enough that a stuck task can't leave the user
/// staring at a "quitting…" UI.
const SHUTDOWN_DEADLINE: Duration = Duration::from_secs(5);

/// Hard ceiling. From the moment `run` is invoked, the process is
/// **guaranteed** to terminate within this duration — the doomsday timer
/// fires `process::exit(137)` no matter what state the cooperative
/// shutdown is in. Set deliberately larger than [`SHUTDOWN_DEADLINE`] so
/// the normal path (cooperative shutdown finishes, caller calls
/// `process::exit(0)`) wins the race on every healthy quit.
const HARD_DEADLINE: Duration = Duration::from_secs(8);

/// Ensures the doomsday timer is armed at most once even when `run` is
/// called from multiple quit paths racing each other (rare: tray Quit +
/// SIGINT delivered simultaneously). Without this, two timers would
/// queue up `process::exit` calls — harmless but noisy in logs.
static DOOMSDAY_ARMED: AtomicBool = AtomicBool::new(false);

/// Best-effort graceful shutdown. Runs the cancellation sequence with a
/// bounded deadline. Safe to call from any quit path; idempotent because
/// every signal it sends is "set this once".
pub async fn run<R: Runtime>(app: &AppHandle<R>) {
    info!("drift-lab: graceful shutdown starting");

    // ── Step 1: arm the doomsday timer ───────────────────────────────
    // Detached task — survives even if every awaitable below wedges.
    // Picking `tokio::spawn` (not `tauri::async_runtime::spawn`) keeps
    // this independent of any tauri runtime teardown that could happen
    // concurrently with our shutdown.
    arm_doomsday_timer();

    // ── Step 2: cooperative shutdown, bounded by SHUTDOWN_DEADLINE ──
    // Wrapping the entire body (not just the SQLite step) means a
    // poisoned mutex inside `state.cancel_token.lock().await` — or any
    // other future stuck on a deadlock — can't push us past five
    // seconds. The doomsday timer is still our floor; this is the
    // ceiling that lets the normal path return promptly.
    let cooperative = async {
        let state: tauri::State<'_, AppState> = app.state();

        // 2.1 Cancel the active chat / agent stream, if any.
        if let Some(token) = state.cancel_token.lock().await.take() {
            token.cancel();
            info!("drift-lab shutdown: cancelled in-flight chat/agent");
        }

        // 2.2 Signal every per-finding suggestion stream to wind down.
        let suggestions = state.scan_suggestions.cancel_all();
        if suggestions > 0 {
            info!(
                count = suggestions,
                "drift-lab shutdown: cancelled in-flight suggestion streams"
            );
        }

        // 2.3 Flip every per-scan cancel flag. Blocking rayon tasks see
        //     the flag on their next progress callback and panic via
        //     `CancelledByUser`; the runner catches and finalizes them.
        let scans = state.scan_cancels.cancel_all();
        if scans > 0 {
            info!(count = scans, "drift-lab shutdown: cancelled in-flight scans");
        }

        // 2.4 Resolve any parked pickers so their blocking task wakes
        //     and returns instead of dangling on the channel.
        state.scan_pickers.cancel_all();

        // 2.5 Fire the process-wide token. The HTTP server picks this
        //     up via `with_graceful_shutdown` and breaks out of
        //     `axum::serve`.
        state.shutdown.cancel();

        // 2.6 Close the SQLite pool gracefully (flush WAL).
        crate::db::close().await;
    };

    match tokio::time::timeout(SHUTDOWN_DEADLINE, cooperative).await {
        Ok(()) => info!("drift-lab: graceful shutdown complete"),
        Err(_) => warn!(
            timeout_s = SHUTDOWN_DEADLINE.as_secs(),
            "drift-lab: cooperative shutdown timed out — returning to caller, \
             doomsday timer remains armed and will force-exit if needed"
        ),
    }
}

/// Spawn the detached "if we're not out within [`HARD_DEADLINE`], kill the
/// process" task. Idempotent — only the first call actually arms a timer.
fn arm_doomsday_timer() {
    if DOOMSDAY_ARMED.swap(true, Ordering::SeqCst) {
        return;
    }
    tokio::spawn(async {
        tokio::time::sleep(HARD_DEADLINE).await;
        // Emit to stderr directly (not tracing) so the message survives
        // even if the tracing subscriber is mid-teardown. This is the
        // last line of defence — by the time we get here, every nicer
        // option has failed.
        eprintln!(
            "drift-lab: shutdown hard-deadline ({} s) expired — force-exiting (code {})",
            HARD_DEADLINE.as_secs(),
            DOOMSDAY_EXIT_CODE
        );
        std::process::exit(DOOMSDAY_EXIT_CODE);
    });
}

/// Test-only: reset the doomsday-armed flag so multiple test cases can
/// each exercise `arm_doomsday_timer` in isolation. Not exposed in
/// release builds — production callers should never need this.
#[cfg(test)]
fn reset_doomsday_for_tests() {
    DOOMSDAY_ARMED.store(false, Ordering::SeqCst);
}

/// Install POSIX signal handlers (SIGINT / SIGTERM) and the Windows
/// `Ctrl-C` handler. Each delivered signal calls [`AppHandle::exit`] so
/// the quit path is identical to Cmd+Q and tray → Quit — every entry
/// point converges on `RunEvent::ExitRequested`, which in turn runs
/// [`run`] above. No second quit pipeline.
///
/// Why this matters for `make dev`: `cargo tauri dev` forwards `Ctrl+C`
/// to the desktop binary as a POSIX signal. Without a handler the
/// process gets the OS default ("terminate immediately"), so the bundled
/// HTTP server's graceful-drain, the SQLite WAL flush, and any
/// `kill_on_drop` docker children all get skipped. With this installed,
/// Ctrl+C in the dev terminal walks the same five-second graceful path
/// as an in-app quit.
///
/// **Double-press escape hatch.** First signal → graceful (calls
/// `app.exit(0)`). Second signal of any kind → `std::process::exit(130)`.
/// This is the Docker / kubectl / npm pattern: if the graceful path is
/// wedged the user can re-press Ctrl+C and get out instantly. We never
/// stop listening after the first press — the loop keeps reading from
/// the signal stream so the second press is observed.
pub fn install_signal_handlers<R: Runtime>(app: &AppHandle<R>) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        // Install the OS-level handlers once. Doing it inside the loop
        // would re-allocate `Signal` streams on every press AND open a
        // tiny window where a back-to-back signal could be missed
        // between drop and re-install.
        #[cfg(unix)]
        let (mut sigint, mut sigterm) = {
            use tokio::signal::unix::{signal, SignalKind};
            let sigint = match signal(SignalKind::interrupt()) {
                Ok(s) => s,
                Err(e) => {
                    warn!("install SIGINT handler: {e} — Ctrl+C will not be graceful");
                    return;
                }
            };
            let sigterm = match signal(SignalKind::terminate()) {
                Ok(s) => s,
                Err(e) => {
                    warn!("install SIGTERM handler: {e} — `kill` will not be graceful");
                    return;
                }
            };
            (sigint, sigterm)
        };

        // Shared flag so we can distinguish "first signal" from "second
        // signal". An `AtomicBool::swap` makes the check + flip race-free
        // even if SIGINT and SIGTERM arrive back-to-back.
        let received_first = Arc::new(AtomicBool::new(false));

        loop {
            #[cfg(unix)]
            tokio::select! {
                _ = sigint.recv() => {}
                _ = sigterm.recv() => {}
            }
            #[cfg(not(unix))]
            if tokio::signal::ctrl_c().await.is_err() {
                warn!("ctrl-c handler failed — falling back to OS default");
                return;
            }

            if received_first.swap(true, Ordering::SeqCst) {
                // Second signal during the in-flight graceful run.
                // Emit to stderr (not tracing) so the message survives
                // even if the subscriber is mid-teardown, then hard-exit
                // with the conventional SIGINT exit code.
                eprintln!("drift-lab: force-quit on repeat signal");
                std::process::exit(FORCE_QUIT_EXIT_CODE);
            }

            info!("drift-lab: quit signal received, running graceful shutdown");
            // Routes through `RunEvent::ExitRequested` in `lib.rs::run`,
            // which calls `prevent_exit()` + spawns `shutdown::run`. We
            // explicitly do NOT call `shutdown::run` here — that would
            // be a second quit pipeline and would drift over time from
            // the in-app path. One handler, one sequence.
            app.exit(0);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering as AtomicOrdering};
    use std::sync::Arc;

    /// Wire-contract: hard deadline must strictly exceed the cooperative
    /// deadline so the happy path's `process::exit(0)` always beats the
    /// doomsday timer. Flipping these accidentally would force-kill every
    /// normal quit with code 137 — wildly disruptive in CI / logs.
    #[test]
    fn hard_deadline_exceeds_cooperative_deadline() {
        assert!(
            HARD_DEADLINE > SHUTDOWN_DEADLINE,
            "HARD_DEADLINE ({HARD_DEADLINE:?}) must be strictly greater than \
             SHUTDOWN_DEADLINE ({SHUTDOWN_DEADLINE:?}) so the normal exit \
             path wins the race against the doomsday timer"
        );
    }

    #[test]
    fn doomsday_exit_codes_are_unique() {
        // 130 = SIGINT (user pressed Ctrl+C twice), 137 = SIGKILL
        // (doomsday wedge). Keeping them distinct so a post-mortem
        // `$?` reading can tell the two failure modes apart.
        assert_ne!(FORCE_QUIT_EXIT_CODE, DOOMSDAY_EXIT_CODE);
    }

    /// Smoke test for [`arm_doomsday_timer`]'s idempotency. Without the
    /// `swap` guard, a tray-Quit racing with a SIGINT would spawn two
    /// timers and both would call `process::exit` 8 seconds in. The
    /// guard means only the first wins; subsequent arms are no-ops.
    #[tokio::test]
    async fn arm_doomsday_timer_is_idempotent() {
        reset_doomsday_for_tests();
        assert!(!DOOMSDAY_ARMED.load(AtomicOrdering::SeqCst));
        arm_doomsday_timer();
        assert!(DOOMSDAY_ARMED.load(AtomicOrdering::SeqCst));
        // Second call must be a no-op (cannot observe the spawned task
        // directly from here, but if it weren't a no-op we'd double-exit
        // 8s after arming. We assert the flag stays set and the call
        // returns without panicking.)
        arm_doomsday_timer();
        assert!(DOOMSDAY_ARMED.load(AtomicOrdering::SeqCst));
        reset_doomsday_for_tests();
    }

    /// Drives the same `tokio::time::timeout` wrapper used in `run`
    /// against a future that never completes. The wrapper must return
    /// `Err(Elapsed)` even when the inner future is genuinely wedged.
    ///
    /// We use a 50 ms timeout (not [`SHUTDOWN_DEADLINE`]) here because
    /// `tokio::test(start_paused = true)` — which would let us advance
    /// virtual time without sleeping the test runner — needs tokio's
    /// `test-util` feature, which we don't enable. 50 ms is small enough
    /// to keep `cargo test` fast and large enough to be insensitive to
    /// scheduler jitter on busy CI runners.
    #[tokio::test]
    async fn cooperative_timeout_wraps_inner_future() {
        let wedged = async {
            // Never resolves. The outer `timeout` must still complete.
            futures_util::future::pending::<()>().await;
        };
        let result = tokio::time::timeout(Duration::from_millis(50), wedged).await;
        assert!(
            result.is_err(),
            "timeout must fire when inner future hangs past the deadline"
        );
    }

    /// Pattern-mirror of the actual cooperative body: ensure cancelling
    /// a `CancellationToken` (used for the HTTP shutdown signal) is
    /// non-blocking and idempotent. A regression here would silently
    /// stall shutdown for the entire SHUTDOWN_DEADLINE.
    #[tokio::test]
    async fn shutdown_token_cancel_is_instant_and_idempotent() {
        let token = tokio_util::sync::CancellationToken::new();
        // First cancel.
        token.cancel();
        assert!(token.is_cancelled());
        // Second cancel — must not panic or block.
        token.cancel();
        assert!(token.is_cancelled());
    }

    /// Atomic-flag pattern used by the static-scan cancel registry.
    /// Equivalent to what `scan_cancels.cancel_all` does internally.
    /// Pure unit-test of the cancellation primitive so a refactor of
    /// the real registry can't silently break the shutdown shape.
    #[tokio::test]
    async fn atomic_cancel_flag_is_observable_across_tasks() {
        let flag = Arc::new(AtomicBool::new(false));
        let flag_clone = Arc::clone(&flag);
        let handle = tokio::spawn(async move {
            // Poll until the flag flips (mirrors how the progress sink
            // checks on every callback). Bounded by the test timeout so
            // a regression doesn't hang CI.
            for _ in 0..1000 {
                if flag_clone.load(AtomicOrdering::Relaxed) {
                    return true;
                }
                tokio::task::yield_now().await;
            }
            false
        });
        flag.store(true, AtomicOrdering::Relaxed);
        assert!(handle.await.unwrap(), "spawned task must observe the flag flip");
    }
}
