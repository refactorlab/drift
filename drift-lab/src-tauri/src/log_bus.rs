//! Process-wide fan-out for tracing log lines.
//!
//! The tracing layer in `lib.rs::TauriEventLayer` calls [`publish`] once
//! per event. Subscribers come and go independently:
//!
//! * The Tauri-emit task in `setup()` keeps the existing UI behaviour
//!   (lines flow to `BackendLogPane`).
//! * Each `GET /api/logs/stream` SSE handler subscribes for the
//!   lifetime of that HTTP connection.
//!
//! Capacity is bounded — slow subscribers receive `RecvError::Lagged`
//! rather than letting the channel grow unbounded. That keeps memory
//! flat under sustained log floods (rayon-driven static scans hit the
//! thousands-of-lines-per-second range).

use std::sync::OnceLock;

use tokio::sync::broadcast::{channel, error::RecvError, Receiver, Sender};

use crate::events::LogLine;

/// Backlog the broadcast channel holds before dropping the oldest line
/// for slow subscribers. 1024 ≈ 1s of output at a busy scan's peak;
/// past that the subscriber sees `RecvError::Lagged(n)` and can render
/// `[skipped N lines]`.
const CAPACITY: usize = 1024;

static BUS: OnceLock<Sender<LogLine>> = OnceLock::new();

/// Install the broadcast channel. Idempotent; subsequent calls are
/// no-ops. Must run before [`publish`] sees its first event or those
/// events are dropped silently.
pub fn init() {
    BUS.get_or_init(|| {
        let (tx, _rx) = channel(CAPACITY);
        tx
    });
}

/// Push one line to every active subscriber. No-op when no subscribers
/// exist (broadcast::Sender::send returns Err only in that case, which
/// is fine — there's nothing to deliver to).
pub fn publish(line: LogLine) {
    if let Some(tx) = BUS.get() {
        let _ = tx.send(line);
    }
}

/// Subscribe to future log lines. Returns `None` if [`init`] hasn't run
/// yet — the caller is expected to fail soft (the SSE handler returns a
/// 503; the Tauri-emit task waits and retries).
pub fn subscribe() -> Option<Receiver<LogLine>> {
    BUS.get().map(|tx| tx.subscribe())
}

/// Re-export so callers don't pull `tokio::sync::broadcast` directly.
pub use tokio::sync::broadcast::error::RecvError as SubscribeRecvError;

/// Convenience: classify a `recv()` result for callers that want to
/// render lagged subscribers differently. Returning the count of
/// dropped messages lets the SSE handler emit a `[skipped N]` marker
/// without parsing strings.
pub fn classify(result: Result<LogLine, RecvError>) -> SubscribeOutcome {
    match result {
        Ok(line) => SubscribeOutcome::Line(line),
        Err(RecvError::Lagged(n)) => SubscribeOutcome::Lagged(n),
        Err(RecvError::Closed) => SubscribeOutcome::Closed,
    }
}

#[derive(Debug)]
pub enum SubscribeOutcome {
    Line(LogLine),
    Lagged(u64),
    Closed,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Cargo runs `#[test]`s in parallel within a binary, but our bus
    /// is a process-wide static. Every test uses a unique marker
    /// string and loops `recv()` until it sees its own marker, so
    /// concurrent tests' publishes don't poison each other.
    fn marker(name: &str) -> String {
        format!("log_bus_test::{name}::{}", uuid::Uuid::new_v4())
    }

    fn fixture(msg: &str) -> LogLine {
        LogLine {
            ts_ms: 0,
            level: "INFO".into(),
            target: "test".into(),
            message: msg.into(),
        }
    }

    async fn recv_until(rx: &mut tokio::sync::broadcast::Receiver<LogLine>, m: &str) -> LogLine {
        loop {
            // `unwrap` is fine — if the channel closes mid-test we
            // genuinely have a bug worth surfacing.
            let line = rx.recv().await.unwrap();
            if line.message == m {
                return line;
            }
        }
    }

    /// Two subscribers, one publish — both must see the line. This is
    /// the load-bearing fan-out property the SSE route and the
    /// Tauri-emit task both rely on.
    #[tokio::test]
    async fn fan_out_to_multiple_subscribers() {
        init();
        let mut a = subscribe().expect("init");
        let mut b = subscribe().expect("init");
        let m = marker("fan_out");
        publish(fixture(&m));
        let got_a = recv_until(&mut a, &m).await;
        let got_b = recv_until(&mut b, &m).await;
        assert_eq!(got_a.message, m);
        assert_eq!(got_b.message, m);
    }

    /// init() is idempotent — calling twice doesn't replace the channel
    /// (which would orphan existing subscribers).
    #[tokio::test]
    async fn init_is_idempotent() {
        init();
        let mut rx = subscribe().expect("init");
        init();
        let m = marker("idempotent");
        publish(fixture(&m));
        let got = recv_until(&mut rx, &m).await;
        assert_eq!(got.message, m);
    }

    /// publish() before any subscriber must not panic — the tracing
    /// layer fires events long before any SSE / Tauri-emit subscriber
    /// is wired up.
    #[tokio::test]
    async fn publish_without_subscribers_does_not_panic() {
        init();
        // No subscribers held here. The static bus may have OTHER
        // tests' subscribers — that's fine, we only assert "no panic".
        publish(fixture(&marker("no_sub")));
    }

    /// `classify` maps each broadcast `RecvError` variant to the
    /// public enum without doing I/O. Pure unit test — no race with
    /// other parallel tests.
    #[test]
    fn classify_maps_lagged_and_closed() {
        use tokio::sync::broadcast::error::RecvError;
        match classify(Err(RecvError::Lagged(7))) {
            SubscribeOutcome::Lagged(n) => assert_eq!(n, 7),
            other => panic!("expected Lagged(7), got {other:?}"),
        }
        match classify(Err(RecvError::Closed)) {
            SubscribeOutcome::Closed => {}
            other => panic!("expected Closed, got {other:?}"),
        }
        let line = fixture("ok-path");
        match classify(Ok(line.clone())) {
            SubscribeOutcome::Line(got) => assert_eq!(got.message, line.message),
            other => panic!("expected Line, got {other:?}"),
        }
    }
}
