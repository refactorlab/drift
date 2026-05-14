//! Wire types for the static-scan flow.
//!
//! These types cross the Tauri IPC boundary, so the field shapes are part of
//! the public contract with the frontend. Keep the `serde` representation
//! aligned with `desktop-ui/src/lib/scanApi.ts`.
//!
//! Design split — three families:
//!   - **progress** events: streamed while the scan is running.
//!   - **picker** payload: top-N entry roots the user chooses between.
//!   - **summary** payload: the final `Report` view the UI renders.
//!
//! The picker rows are decorated for display only (file path relative to the
//! scanned root, first few callers resolved by name) so the UI never has to
//! reach back into `CallGraph` internals.

use serde::Serialize;

/// One streamed progress event. The frontend dispatches on `kind` to pick an
/// icon and to update the right phase row. Shapes mirror the
/// `drift_static_profiler::Progress` trait so we can forward each callback
/// without lossy translation.
///
/// **Serialization contract** (crucial — the TS handler depends on it):
///   - `rename_all = "snake_case"` renames the **variant tags** so the `kind`
///     discriminator on the wire reads `walk_progress`, not `WalkProgress`.
///   - `rename_all_fields = "camelCase"` renames the **fields inside each
///     variant** to camelCase (so `scan_id` → `scanId`, `files_seen` →
///     `filesSeen`, etc.). Without this, the TS handler reads `ev.scanId` as
///     `undefined`, the `isMine(...)` filter drops every event silently, and
///     the live progress timeline appears completely empty even while the
///     scan is running.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case", rename_all_fields = "camelCase")]
pub enum ScanProgress {
    /// Filesystem walk has begun. No total yet — UI shows a spinner.
    WalkStart {
        scan_id: String,
    },
    /// Periodic walk tick — running count of files discovered so far.
    WalkProgress {
        scan_id: String,
        files_seen: u64,
    },
    /// Walk finished. `bytes` is the combined size of every file walked.
    WalkEnd {
        scan_id: String,
        total_files: u64,
        bytes: u64,
    },
    /// Parse phase starting — `total` source files queued for tree-sitter.
    ParseStart {
        scan_id: String,
        total_source_files: u64,
    },
    /// One source file finished parsing.
    ParseProgress {
        scan_id: String,
        done: u64,
        total: u64,
        current: Option<String>,
    },
    /// Atomic post-parse phase started (graph build, collect entries, …).
    Phase {
        scan_id: String,
        name: String,
    },
    /// Counted post-parse phase started.
    StepStart {
        scan_id: String,
        label: String,
        total: u64,
    },
    /// Counted post-parse phase progress.
    StepProgress {
        scan_id: String,
        label: String,
        done: u64,
        total: u64,
        current: Option<String>,
    },
}

/// One row in the top-N entry-root picker. Same fields as
/// `drift_static_profiler::PickerRoot`, mapped to camelCase via `serde`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanPickerRoot {
    pub index: usize,
    pub name: String,
    pub file: String,
    pub line: usize,
    pub reach: usize,
    pub callers: Vec<ScanPickerCaller>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanPickerCaller {
    pub name: String,
    pub file: String,
    pub line: usize,
}

/// Emitted once root discovery completes and the user has to choose. The
/// scan is parked until [`crate::scan::runner::select_entry`] is called.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanEntriesReady {
    pub scan_id: String,
    pub roots: Vec<ScanPickerRoot>,
}

/// Emitted once the final Report has been serialised to disk. The UI fetches
/// the report body via `load_scan(scan_id)` and renders the summary cards.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanComplete {
    pub scan_id: String,
    /// Absolute path to the saved JSON under `~/.drift/scans/`.
    pub saved_path: String,
    /// Display label for the picked root, so the UI can show "scan complete
    /// for `<name>`" without rehydrating the whole picker payload.
    pub picked_root: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanError {
    pub scan_id: String,
    pub message: String,
}

/// Emitted once per finding *before* the LLM stream opens. Carries the row
/// metadata so the UI can render the row skeleton (badges, file:line) with a
/// streaming spinner immediately — before any text deltas arrive.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSuggestionStart {
    pub scan_id: String,
    pub index: usize,
    pub source: &'static str,
    pub kind: String,
    pub severity: String,
    pub file: String,
    pub line: usize,
    pub name: String,
}

/// One text delta from the provider stream. We forward every non-empty chunk
/// the provider yields so the UI grows the body live, OpenAI-style.
///
/// The `delta` is a fragment to *append* to the row's accumulated body — the
/// frontend never has to re-assemble or diff against a previous snapshot.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSuggestionDelta {
    pub scan_id: String,
    pub index: usize,
    pub delta: String,
}

/// Emitted once per finding *after* the stream drains. Carries the full
/// settled body so the UI can reconcile its delta accumulator (covers any
/// lost frames) and clear the row's streaming flag.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSuggestion {
    pub scan_id: String,
    /// Stable index in the merged finding list (findings_top → immediate_fixes
    /// → refactor_candidates) so the UI can render them in order.
    pub index: usize,
    /// One of "finding", "immediate_fix", "refactor_candidate".
    pub source: &'static str,
    /// "kind" from the underlying finding (e.g. n_plus_one, hot_zone).
    pub kind: String,
    pub severity: String,
    pub file: String,
    pub line: usize,
    pub name: String,
    /// Suggestion body — formatted as the model returned it, expected to be
    /// markdown with one fenced code block plus a one-line rationale.
    pub suggestion: String,
}

/// Emitted when the suggestion phase finishes — total count + how many failed
/// (so the UI can show "12 of 14 succeeded").
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSuggestionDone {
    pub scan_id: String,
    pub total: usize,
    pub failed: usize,
}

pub mod topic {
    /// Streamed progress event (one per pipeline callback).
    pub const PROGRESS: &str = "scan://progress";
    /// Picker payload — UI prompts the user to choose a root.
    pub const ENTRIES_READY: &str = "scan://entries-ready";
    /// Final summary saved to disk.
    pub const COMPLETE: &str = "scan://complete";
    pub const ERROR: &str = "scan://error";

    /// Row metadata emitted before the LLM stream opens — UI seeds an empty
    /// row with a streaming spinner.
    pub const SUGGESTION_START: &str = "scan://suggestion-start";
    /// Per-chunk text delta from the provider stream — append to the row body.
    pub const SUGGESTION_DELTA: &str = "scan://suggestion-delta";
    /// Final settled body for one finding — UI clears the streaming flag and
    /// reconciles its accumulator against this canonical text.
    pub const SUGGESTION: &str = "scan://suggestion";
    /// Phase done — emitted once when every finding has been processed.
    pub const SUGGESTION_DONE: &str = "scan://suggestion-done";
}

#[cfg(test)]
mod tests {
    //! Wire-contract tests. These exist because a serde attribute regression
    //! on `ScanProgress` once caused every progress event to be silently
    //! dropped by the frontend (snake_case fields didn't match the camelCase
    //! TS interface). Each assertion below pins one field name on the wire
    //! so a future "tidy-up" of the attributes can't reintroduce that bug.

    use super::*;

    fn json(v: impl Serialize) -> String {
        serde_json::to_string(&v).expect("serialize")
    }

    #[test]
    fn scan_progress_walk_progress_uses_camelcase_fields() {
        let s = json(ScanProgress::WalkProgress {
            scan_id: "abc".into(),
            files_seen: 42,
        });
        assert!(s.contains("\"kind\":\"walk_progress\""), "wire: {s}");
        assert!(s.contains("\"scanId\":\"abc\""), "wire: {s}");
        assert!(s.contains("\"filesSeen\":42"), "wire: {s}");
        assert!(!s.contains("scan_id"), "snake_case leaked: {s}");
        assert!(!s.contains("files_seen"), "snake_case leaked: {s}");
    }

    #[test]
    fn scan_progress_parse_progress_uses_camelcase_fields() {
        let s = json(ScanProgress::ParseProgress {
            scan_id: "x".into(),
            done: 1,
            total: 2,
            current: Some("foo.rs".into()),
        });
        assert!(s.contains("\"kind\":\"parse_progress\""), "wire: {s}");
        assert!(s.contains("\"scanId\":\"x\""), "wire: {s}");
    }

    #[test]
    fn scan_progress_walk_end_renames_total_files_and_bytes() {
        let s = json(ScanProgress::WalkEnd {
            scan_id: "x".into(),
            total_files: 99,
            bytes: 1024,
        });
        assert!(s.contains("\"totalFiles\":99"), "wire: {s}");
        assert!(s.contains("\"bytes\":1024"), "wire: {s}");
        assert!(!s.contains("total_files"), "snake_case leaked: {s}");
    }

    #[test]
    fn scan_progress_parse_start_renames_total_source_files() {
        let s = json(ScanProgress::ParseStart {
            scan_id: "x".into(),
            total_source_files: 1234,
        });
        assert!(s.contains("\"totalSourceFiles\":1234"), "wire: {s}");
        assert!(!s.contains("total_source_files"), "snake_case leaked: {s}");
    }
}
