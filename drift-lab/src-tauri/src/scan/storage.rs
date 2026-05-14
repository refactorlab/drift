//! On-disk storage for saved scans under `~/.drift/scans/`.
//!
//! The user explicitly asked for `~/.drift/scans/*.json` (not Tauri's
//! `app_data_dir`), so the scans live next to whatever the CLI variant
//! produces — a single shared store across the desktop app and the CLI.
//!
//! File layout:
//!   ~/.drift/scans/
//!     <scan_id>.json                         ← `drift_static_profiler::Report` envelope
//!     <scan_id>/
//!       code-suggestions/
//!         <finding-index>.json               ← LLM "Study this" output (one per finding)
//!
//! Why split: the scan envelope is deterministic analyzer output; the
//! suggestions are LLM-generated and per-finding, written incrementally as
//! the user clicks "Study this" on each row. Bundling them in the envelope
//! would force a full re-serialize of the report on every per-finding save
//! — wasteful, and a write race if two findings finalize back-to-back.
//! One file per `(scan_id, index)` gives atomic per-row writes and a
//! browseable folder layout the user can inspect directly.
//!
//! Scan IDs are UUIDs generated at scan start so the same `scan_id` carries
//! through progress events → final write → suggestion stream.

use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use drift_static_profiler::report::Report;
use serde::{Deserialize, Serialize};

use super::types::ScanPickerRoot;

/// `~/.drift` — created on first use if missing. Returns an error only on
/// the rare case where `$HOME` itself is unset.
pub fn drift_dir() -> Result<PathBuf> {
    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .context("HOME env var not set — cannot locate ~/.drift")?;
    Ok(home.join(".drift"))
}

/// `~/.drift/scans/`. Created on demand. Symlink-safe — we always operate on
/// the resolved path so a hostile symlink target can't break out of `~`.
pub fn scans_dir() -> Result<PathBuf> {
    let dir = drift_dir()?.join("scans");
    std::fs::create_dir_all(&dir)
        .with_context(|| format!("creating {}", dir.display()))?;
    Ok(dir)
}

fn scan_path(scan_id: &str) -> Result<PathBuf> {
    validate_scan_id(scan_id)?;
    Ok(scans_dir()?.join(format!("{scan_id}.json")))
}

/// Single source of truth for "is this scan_id safe to embed in a path?".
/// Rejects empty / traversal sequences. Inlined into every function that
/// builds a path from a user-controllable id so a future caller can't
/// accidentally skip the check.
fn validate_scan_id(scan_id: &str) -> Result<()> {
    if scan_id.is_empty() || scan_id.contains('/') || scan_id.contains('\\') {
        anyhow::bail!("invalid scan id: {scan_id:?}");
    }
    Ok(())
}

/// `~/.drift/scans/<scan_id>/code-suggestions/`. Created on demand. The
/// per-scan parent dir lives alongside `<scan_id>.json` — they coexist
/// safely because one is a file with a `.json` extension and the other is
/// a bare directory. No migration needed for older scans: this dir simply
/// doesn't exist for them and [`list_saved_suggestions`] returns empty.
pub fn suggestions_dir(scan_id: &str) -> Result<PathBuf> {
    validate_scan_id(scan_id)?;
    let dir = scans_dir()?.join(scan_id).join("code-suggestions");
    std::fs::create_dir_all(&dir)
        .with_context(|| format!("creating {}", dir.display()))?;
    Ok(dir)
}

/// One persisted LLM suggestion. Mirrors the fields of the wire-side
/// `ScanSuggestion` payload so the UI can re-hydrate a row without
/// re-running the model. `savedAt` is RFC-3339 UTC.
///
/// Wire format is camelCase via `rename_all`; the snake_case `alias` line
/// keeps deserialization forward-compatible if a future migration changes
/// the on-disk shape and an older app version has to read it.
/// Every flat file written before the versioned layout (the v0 → v1
/// migration) deserializes with this value when the JSON has no `version`
/// field. Reading legacy data must still produce a sane `SavedSuggestion`
/// — version 1 says "this is the first take, no prior history".
fn default_version_one() -> u32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedSuggestion {
    pub index: usize,
    /// 1-based sequence number within the per-finding version history.
    /// Each click of "Study this" on the same finding writes the next
    /// version (max-existing + 1). The UI displays it as "v3 of 3".
    /// `default = 1` keeps pre-versioning files loadable.
    #[serde(default = "default_version_one")]
    pub version: u32,
    pub source: String,
    pub kind: String,
    pub severity: String,
    pub file: String,
    pub line: usize,
    pub name: String,
    pub suggestion: String,
    #[serde(alias = "saved_at")]
    pub saved_at: String,
}

/// On-disk path of the *legacy* flat suggestion file (one per finding
/// index, no version history). Used only by the migration helper.
fn legacy_flat_suggestion_path(scan_id: &str, index: usize) -> Result<PathBuf> {
    Ok(suggestions_dir(scan_id)?.join(format!("{index}.json")))
}

/// Per-finding history folder: `~/.drift/scans/<scan_id>/code-suggestions/
/// <index>/`. Each Study This run writes one `v<N>.json` here so the user
/// can navigate back through prior takes without re-running the model.
fn finding_history_dir(scan_id: &str, index: usize) -> Result<PathBuf> {
    let dir = suggestions_dir(scan_id)?.join(index.to_string());
    std::fs::create_dir_all(&dir)
        .with_context(|| format!("creating {}", dir.display()))?;
    Ok(dir)
}

/// If a legacy flat `<index>.json` exists for this finding, move it into
/// the new history folder as `v1.json` so all subsequent reads pick it up
/// from a single canonical location. Idempotent — when the flat file is
/// already gone (already migrated, or never existed), this is a no-op.
/// Atomic via `rename(2)`.
fn migrate_legacy_flat_if_present(scan_id: &str, index: usize) -> Result<()> {
    let flat = legacy_flat_suggestion_path(scan_id, index)?;
    if !flat.is_file() {
        return Ok(());
    }
    // Read the legacy body once, re-write with an explicit `version: 1` so
    // future loads don't have to lean on the serde default. This makes the
    // migration self-describing on disk — anyone inspecting the file can
    // see it's a v1 record without having to know about implicit defaults.
    let bytes = std::fs::read(&flat)
        .with_context(|| format!("reading legacy {}", flat.display()))?;
    let mut existing: SavedSuggestion = serde_json::from_slice(&bytes)
        .with_context(|| format!("parsing legacy {}", flat.display()))?;
    existing.version = 1;

    let dir = finding_history_dir(scan_id, index)?;
    let target = dir.join("v1.json");
    let tmp = target.with_extension("json.tmp");
    let json = serde_json::to_vec_pretty(&existing)
        .context("serializing migrated suggestion")?;
    std::fs::write(&tmp, &json)
        .with_context(|| format!("writing {}", tmp.display()))?;
    std::fs::rename(&tmp, &target)
        .with_context(|| format!("renaming {} → {}", tmp.display(), target.display()))?;
    // Only remove the legacy file after the new one is durably written.
    // A crash mid-migration leaves both files briefly — the next call
    // re-runs the migration safely (the read-write-rename above is
    // idempotent for the same content).
    std::fs::remove_file(&flat)
        .with_context(|| format!("removing legacy {}", flat.display()))?;
    Ok(())
}

/// Read every `v*.json` in this finding's history folder, sorted by
/// version ascending. Empty if the folder doesn't exist (no Study This
/// has been clicked yet for this index).
fn read_history(scan_id: &str, index: usize) -> Result<Vec<SavedSuggestion>> {
    let dir = suggestions_dir(scan_id)?.join(index.to_string());
    if !dir.is_dir() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir)
        .with_context(|| format!("reading {}", dir.display()))?
    {
        let entry = match entry { Ok(e) => e, Err(_) => continue };
        let path = entry.path();
        let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
        // Only `v<N>.json` files count. Filtering by stem keeps `*.tmp` /
        // user droppings out of the history list without an extra stat.
        if !stem.starts_with('v') || path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        match std::fs::read(&path) {
            Ok(bytes) => match serde_json::from_slice::<SavedSuggestion>(&bytes) {
                Ok(s) => out.push(s),
                Err(e) => tracing::warn!(path = %path.display(), "malformed suggestion: {e:#}"),
            },
            Err(e) => tracing::warn!(path = %path.display(), "unreadable suggestion: {e:#}"),
        }
    }
    out.sort_by_key(|s| s.version);
    Ok(out)
}

/// Persist a freshly-streamed suggestion as the NEXT version for its
/// finding — old versions remain on disk so the UI can offer history
/// navigation. Atomic write (tmp → rename) on a unique filename, so
/// concurrent re-studies of the same finding still each get their own
/// version slot.
///
/// Legacy migration: if a flat `<index>.json` exists from before
/// versioning shipped, we move it into the history folder as `v1.json`
/// first, then write the new content as `v2.json`. The migration is
/// idempotent — repeated calls after the flat file is gone are no-ops.
///
/// Caller-side "don't persist empty buffers" is the convention; we don't
/// enforce it here (an empty body is a valid file).
///
/// **Caller must not pre-set `payload.version`** — this function assigns
/// it. The returned struct + path reflect the assigned version.
pub fn save_suggestion(scan_id: &str, payload: &SavedSuggestion) -> Result<PathBuf> {
    let index = payload.index;
    migrate_legacy_flat_if_present(scan_id, index)?;

    let history = read_history(scan_id, index)?;
    let next_version = history.iter().map(|s| s.version).max().unwrap_or(0) + 1;

    let dir = finding_history_dir(scan_id, index)?;
    let path = dir.join(format!("v{next_version}.json"));
    let tmp = path.with_extension("json.tmp");

    let mut stamped = payload.clone();
    stamped.version = next_version;
    let json = serde_json::to_vec_pretty(&stamped)
        .context("serializing suggestion")?;
    std::fs::write(&tmp, &json)
        .with_context(|| format!("writing {}", tmp.display()))?;
    std::fs::rename(&tmp, &path)
        .with_context(|| format!("renaming {} → {}", tmp.display(), path.display()))?;
    Ok(path)
}

/// Enumerate the LATEST version of every persisted suggestion for
/// `scan_id`. Sorted by `index` ascending. Returns an empty vec if the
/// scan has no suggestions folder yet — that's the not-populated state,
/// not an error.
///
/// Handles both layouts transparently:
///   - Legacy flat `<index>.json` files (pre-versioning) — read in place,
///     surface as version 1.
///   - New per-finding history folders `<index>/v<N>.json` — return the
///     row with the largest version number.
pub fn list_saved_suggestions(scan_id: &str) -> Result<Vec<SavedSuggestion>> {
    validate_scan_id(scan_id)?;
    let dir = scans_dir()?.join(scan_id).join("code-suggestions");
    if !dir.is_dir() {
        return Ok(Vec::new());
    }
    let mut latest_by_index: std::collections::BTreeMap<usize, SavedSuggestion> =
        std::collections::BTreeMap::new();

    for entry in std::fs::read_dir(&dir)
        .with_context(|| format!("reading {}", dir.display()))?
    {
        let entry = match entry { Ok(e) => e, Err(_) => continue };
        let path = entry.path();

        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
            // Legacy flat file — `<index>.json`. Read it; treat as v1 if
            // the saved JSON has no version field.
            match std::fs::read(&path) {
                Ok(bytes) => match serde_json::from_slice::<SavedSuggestion>(&bytes) {
                    Ok(s) => {
                        // Only insert if the history folder for this index
                        // doesn't already have a newer version. The dir
                        // walk order is arbitrary, so we may see either
                        // form first — last-write-wins by version number.
                        let entry_idx = s.index;
                        let next_higher_version = latest_by_index
                            .get(&entry_idx)
                            .map(|prev| prev.version)
                            .unwrap_or(0);
                        if s.version >= next_higher_version {
                            latest_by_index.insert(entry_idx, s);
                        }
                    }
                    Err(e) => tracing::warn!(path = %path.display(), "malformed suggestion: {e:#}"),
                },
                Err(e) => tracing::warn!(path = %path.display(), "unreadable suggestion: {e:#}"),
            }
            continue;
        }

        if path.is_dir() {
            // New per-finding history folder — `<index>/`. Index is the
            // folder name; we read every `v<N>.json` and keep the one
            // with the largest version.
            let index = match path.file_name().and_then(|n| n.to_str()).and_then(|n| n.parse::<usize>().ok()) {
                Some(i) => i,
                None => continue, // unrelated subdir — skip without warning
            };
            let history = read_history(scan_id, index)?;
            if let Some(latest) = history.into_iter().max_by_key(|s| s.version) {
                let next_higher_version = latest_by_index
                    .get(&index)
                    .map(|prev| prev.version)
                    .unwrap_or(0);
                if latest.version >= next_higher_version {
                    latest_by_index.insert(index, latest);
                }
            }
        }
    }

    Ok(latest_by_index.into_values().collect())
}

/// Return every version of one finding's suggestions, newest first. Used
/// by the "Version history" picker on each row of the report page. Empty
/// when the finding has never been studied.
///
/// Handles both layouts:
///   - If a legacy flat file exists, it shows up as a v1 entry.
///   - If a versioned history exists, every `v<N>.json` is returned.
///   - If both happen to coexist transiently during migration, the
///     versioned entries are authoritative (legacy is collapsed under
///     v1, and any `v<N>` with N>=1 supersedes it).
pub fn list_suggestion_versions(
    scan_id: &str,
    index: usize,
) -> Result<Vec<SavedSuggestion>> {
    validate_scan_id(scan_id)?;
    let mut versions = read_history(scan_id, index)?;

    // If no versioned history yet, look for a legacy flat file. This is
    // the "just upgraded — haven't re-studied yet" case.
    if versions.is_empty() {
        let flat = legacy_flat_suggestion_path(scan_id, index)?;
        if flat.is_file() {
            match std::fs::read(&flat) {
                Ok(bytes) => match serde_json::from_slice::<SavedSuggestion>(&bytes) {
                    Ok(mut s) => {
                        if s.version == 0 {
                            s.version = 1;
                        }
                        versions.push(s);
                    }
                    Err(e) => tracing::warn!(path = %flat.display(), "malformed suggestion: {e:#}"),
                },
                Err(e) => tracing::warn!(path = %flat.display(), "unreadable suggestion: {e:#}"),
            }
        }
    }

    // Newest first — the UI typically wants to render "v3" as the
    // default selection at the top of the dropdown.
    versions.sort_by(|a, b| b.version.cmp(&a.version));
    Ok(versions)
}

/// Persist a freshly-built `Report` alongside the full picker-root list the
/// scan considered. Wraps everything in a thin envelope so the UI gets
/// scan_id + saved_at + the candidate entries without parsing the file body.
/// Atomic write (tmp → rename) so a crash in the middle never leaves a
/// half-JSON.
///
/// `picker_roots` is the *complete* list `analyze_picked_with_progress`
/// surfaced — not just the one the user chose. We cache it so a later
/// `restart_scan_from_cache` can offer the same menu without re-running the
/// discovery phase.
pub fn save_report(
    scan_id: &str,
    report: &Report,
    picker_roots: &[ScanPickerRoot],
) -> Result<PathBuf> {
    let path = scan_path(scan_id)?;
    let tmp = path.with_extension("json.tmp");
    let env = ScanEnvelope {
        scan_id,
        saved_at: now_rfc3339(),
        report,
        picker_roots,
    };
    let json = serde_json::to_vec_pretty(&env)
        .context("serializing report envelope")?;
    std::fs::write(&tmp, &json)
        .with_context(|| format!("writing {}", tmp.display()))?;
    std::fs::rename(&tmp, &path)
        .with_context(|| format!("renaming {} → {}", tmp.display(), path.display()))?;
    Ok(path)
}

/// Read a saved scan back. Returns the envelope so the caller can read the
/// `Report` plus the saved_at timestamp. Errors include "not found" cleanly.
pub fn load_envelope(scan_id: &str) -> Result<StoredScan> {
    let path = scan_path(scan_id)?;
    let bytes = std::fs::read(&path)
        .with_context(|| format!("reading {}", path.display()))?;
    let stored: StoredScan = serde_json::from_slice(&bytes)
        .with_context(|| format!("parsing {}", path.display()))?;
    Ok(stored)
}

/// Delete the saved scan envelope for `scan_id`. Idempotent — a missing
/// file resolves to `Ok(())` so retries from a UI that lost the previous
/// response don't bubble up a spurious 404. Path-traversal-safe via
/// [`scan_path`], so `delete_scan("../etc/passwd")` rejects before ever
/// touching the filesystem.
///
/// Concurrency note: the LLM "Study this" driver writes versions back to
/// the same envelope while it streams. Deleting mid-stream is benign:
/// the driver's next `save_report` either succeeds (and re-creates the
/// file the user just deleted — surprising, but the user can delete
/// again) or fails cleanly. We deliberately don't gate delete on
/// suggestion-driver state; that would couple this module to the driver
/// registry and the race window is small enough in practice that the
/// simpler API wins.
pub fn delete_scan(scan_id: &str) -> Result<()> {
    let path = scan_path(scan_id)?;
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e).with_context(|| format!("deleting {}", path.display())),
    }
}

/// Coarse metadata for the scans index. We don't parse the whole `Report`
/// body — just the envelope head + filesystem mtime — so listing 100 scans is
/// cheap.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanMeta {
    pub scan_id: String,
    pub saved_at: String,
    pub source_root: Option<String>,
    pub profiled_language: Option<String>,
    pub files: u32,
    pub symbols: u32,
    pub findings_total: u32,
}

/// Enumerate every saved scan. Sorted by saved_at descending (newest first).
/// A malformed file is logged + skipped — the user can still see the rest.
pub fn list_scans() -> Result<Vec<ScanMeta>> {
    let dir = scans_dir()?;
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir)
        .with_context(|| format!("reading {}", dir.display()))?
    {
        let entry = match entry { Ok(e) => e, Err(_) => continue };
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        match read_meta(&path) {
            Ok(meta) => out.push(meta),
            Err(e) => tracing::warn!(path = %path.display(), "skipping malformed scan: {e:#}"),
        }
    }
    out.sort_by(|a, b| b.saved_at.cmp(&a.saved_at));
    Ok(out)
}

fn read_meta(path: &Path) -> Result<ScanMeta> {
    let bytes = std::fs::read(path)?;
    let stored: StoredScan = serde_json::from_slice(&bytes)?;
    let summary = &stored.report.summary;
    let findings_total: u32 = summary
        .findings_by_kind
        .values()
        .map(|v| *v as u32)
        .sum();
    Ok(ScanMeta {
        scan_id: stored.scan_id,
        saved_at: stored.saved_at,
        source_root: stored.report.generator.source_root.clone(),
        profiled_language: summary.profiled_language.clone(),
        files: summary.files as u32,
        symbols: summary.symbols as u32,
        findings_total,
    })
}

#[derive(Debug, Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StoredScan {
    /// `alias = "scan_id"` keeps deserialization compatible with envelopes
    /// written before the camelCase rename — older on-disk scans still
    /// load. Serialization always emits the modern camelCase key.
    #[serde(alias = "scan_id")]
    pub scan_id: String,
    #[serde(alias = "saved_at")]
    pub saved_at: String,
    pub report: Report,
    /// Full picker-root list the discovery phase produced. `default` keeps
    /// scans saved before this field existed loadable — they come back with
    /// an empty list and the UI gracefully hides the "Pick another entry"
    /// button rather than throwing a parse error.
    #[serde(default, alias = "picker_roots")]
    pub picker_roots: Vec<ScanPickerRoot>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanEnvelope<'a> {
    scan_id: &'a str,
    saved_at: String,
    report: &'a Report,
    picker_roots: &'a [ScanPickerRoot],
}

fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build the smallest plausible `Report` value — just enough for the
    /// envelope round-trip + meta-extraction code to exercise their full
    /// paths. We don't care about the entries here.
    fn fixture() -> Report {
        let summary_json = serde_json::json!({
            "languages": ["rust"],
            "files": 3,
            "symbols": 12,
            "edges": 18,
            "categories": {},
            "top_callers": [],
            "top_callees": [],
            "hot_paths": [],
            "dead_code": [],
            "pagerank_top": [],
            "recursive_symbols": [],
            "language_breakdown": [],
            "profiled_language": "rust",
            "profiled_language_percent": 100.0,
            "findings_by_kind": {"n_plus_one": 2, "hot_zone": 1},
        });
        let report_json = serde_json::json!({
            "schema_version": "1.0",
            "mode": "static",
            "generator": {
                "tool": "drift-static-profiler",
                "version": "0.1.0",
                "source_root": "/tmp/example",
            },
            "summary": summary_json,
            "entries": [],
        });
        serde_json::from_value(report_json).unwrap()
    }

    #[test]
    fn round_trips_report_through_disk_under_home() {
        // We piggy-back on the real ~/.drift/scans/ — there's no easier
        // way to honour the user's hard-coded path requirement without
        // pretending to be elsewhere. Use a unique scan_id to avoid
        // colliding with any real scan the dev might have on disk.
        let scan_id = format!("drift-storage-test-{}", uuid::Uuid::new_v4());

        let report = fixture();
        let saved = save_report(&scan_id, &report, &[]).unwrap();
        assert!(saved.exists(), "save_report must write the file");

        let stored = load_envelope(&scan_id).unwrap();
        assert_eq!(stored.scan_id, scan_id);
        assert_eq!(stored.report.generator.tool, "drift-static-profiler");
        assert_eq!(stored.report.summary.files, 3);

        // list_scans should surface this row.
        let listed = list_scans().unwrap();
        let row = listed
            .iter()
            .find(|m| m.scan_id == scan_id)
            .expect("listed must include just-saved scan");
        assert_eq!(row.findings_total, 3, "2 + 1 from findings_by_kind");
        assert_eq!(row.files, 3);
        assert_eq!(row.profiled_language.as_deref(), Some("rust"));

        // Cleanup — keep the user's ~/.drift/scans/ free of test droppings.
        let _ = std::fs::remove_file(&saved);
    }

    #[test]
    fn rejects_path_traversal_in_scan_id() {
        let err1 = save_report("../boom", &fixture(), &[]).unwrap_err();
        assert!(err1.to_string().contains("invalid scan id"));
        let err2 = save_report("", &fixture(), &[]).unwrap_err();
        assert!(err2.to_string().contains("invalid scan id"));
    }

    #[test]
    fn delete_scan_removes_file_and_is_idempotent() {
        let scan_id = format!("drift-delete-test-{}", uuid::Uuid::new_v4());

        // First: save, then delete — file must be gone afterwards.
        let saved = save_report(&scan_id, &fixture(), &[]).unwrap();
        assert!(saved.exists(), "precondition: save_report writes the file");
        delete_scan(&scan_id).expect("delete must succeed on existing file");
        assert!(
            !saved.exists(),
            "delete_scan must actually remove the file"
        );

        // Second: deleting again is a clean Ok(()) — UIs that lose the
        // response and retry shouldn't see a 404.
        delete_scan(&scan_id).expect("delete must be idempotent");

        // load_envelope on a deleted scan must surface a clean error.
        let err = load_envelope(&scan_id).unwrap_err().to_string();
        assert!(
            err.to_lowercase().contains("no such file") || err.contains("reading"),
            "load after delete should report a missing file, got: {err}"
        );
    }

    #[test]
    fn delete_scan_rejects_path_traversal() {
        let err1 = delete_scan("../etc/passwd").unwrap_err();
        assert!(err1.to_string().contains("invalid scan id"));
        let err2 = delete_scan("").unwrap_err();
        assert!(err2.to_string().contains("invalid scan id"));
        let err3 = delete_scan("a/b").unwrap_err();
        assert!(err3.to_string().contains("invalid scan id"));
    }

    #[test]
    fn loads_legacy_snake_case_envelope() {
        // Existing on-disk scans pre-date the picker_roots feature AND were
        // written with snake_case field names (no rename_all on the
        // envelope). Deserialization must still succeed against today's
        // struct — otherwise every previously-saved scan vanishes from the
        // scans list. Pin the contract with a synthetic legacy file.
        let legacy_json = serde_json::json!({
            "scan_id": "legacy-fixture-abc",
            "saved_at": "2026-04-01T00:00:00Z",
            "report": {
                "schema_version": "1.0",
                "mode": "static",
                "generator": {
                    "tool": "drift-static-profiler",
                    "version": "0.1.0",
                    "source_root": "/tmp/x",
                },
                "summary": {
                    "languages": ["rust"],
                    "files": 1,
                    "symbols": 1,
                    "edges": 0,
                    "categories": {},
                    "top_callers": [],
                    "top_callees": [],
                    "hot_paths": [],
                    "dead_code": [],
                    "pagerank_top": [],
                    "recursive_symbols": [],
                    "language_breakdown": [],
                    "profiled_language": "rust",
                    "profiled_language_percent": 100.0,
                    "findings_by_kind": {},
                },
                "entries": [],
            },
        });
        let stored: StoredScan =
            serde_json::from_value(legacy_json).expect("legacy envelope must still load");
        assert_eq!(stored.scan_id, "legacy-fixture-abc");
        assert_eq!(stored.saved_at, "2026-04-01T00:00:00Z");
        assert!(stored.picker_roots.is_empty(), "default for missing field");
    }

    /// Test factory — keeps the verbose struct literal out of every test
    /// body. Callers override only the fields that matter for the scenario.
    fn sample_suggestion(index: usize) -> SavedSuggestion {
        SavedSuggestion {
            index,
            version: 0, // overwritten by save_suggestion
            source: "immediate_fix".into(),
            kind: "n_plus_one".into(),
            severity: "high".into(),
            file: "src/repo.rs".into(),
            line: 42,
            name: format!("Repo.fetch_{index}"),
            suggestion: format!("body for finding {index}"),
            saved_at: "2026-05-14T12:00:00Z".into(),
        }
    }

    #[test]
    fn round_trips_saved_suggestion() {
        let scan_id = format!("drift-suggestion-test-{}", uuid::Uuid::new_v4());
        let s = sample_suggestion(3);

        let saved = save_suggestion(&scan_id, &s).unwrap();
        assert!(saved.exists());
        // New layout: versioned file inside per-finding folder.
        assert_eq!(saved.file_name().and_then(|n| n.to_str()), Some("v1.json"));
        assert_eq!(
            saved
                .parent()
                .and_then(|p| p.file_name())
                .and_then(|n| n.to_str()),
            Some("3"),
        );

        let listed = list_saved_suggestions(&scan_id).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].index, 3);
        assert_eq!(listed[0].version, 1, "first save lands as v1");
        assert!(listed[0].suggestion.contains("body for finding 3"));

        // Cleanup — keep the user's ~/.drift/scans/ free of test droppings.
        let dir = scans_dir().unwrap().join(&scan_id);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn save_suggestion_appends_next_version() {
        let scan_id = format!("drift-versions-test-{}", uuid::Uuid::new_v4());
        // Three back-to-back saves for the same finding index should land
        // as v1, v2, v3 — old versions stay on disk so the UI can offer
        // history navigation.
        for _ in 0..3 {
            save_suggestion(&scan_id, &sample_suggestion(0)).unwrap();
        }

        let history = list_suggestion_versions(&scan_id, 0).unwrap();
        assert_eq!(history.len(), 3);
        // Newest-first ordering — UI default selection is the latest.
        assert_eq!(
            history.iter().map(|s| s.version).collect::<Vec<_>>(),
            vec![3, 2, 1],
        );

        // `list_saved_suggestions` returns only the LATEST per index.
        let latest = list_saved_suggestions(&scan_id).unwrap();
        assert_eq!(latest.len(), 1);
        assert_eq!(latest[0].version, 3);

        let dir = scans_dir().unwrap().join(&scan_id);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn migrates_legacy_flat_file_into_versioned_history() {
        // Simulate a scan persisted by an older app version: a flat
        // `<index>.json` directly under `code-suggestions/`. The first
        // call to `save_suggestion` for that index should move the flat
        // file into the new history folder as `v1.json` and append the
        // fresh content as `v2.json`. Read paths must report both.
        let scan_id = format!("drift-migrate-test-{}", uuid::Uuid::new_v4());
        let dir = suggestions_dir(&scan_id).unwrap();
        let flat = dir.join("7.json");
        let legacy = sample_suggestion(7);
        std::fs::write(&flat, serde_json::to_vec_pretty(&legacy).unwrap()).unwrap();
        assert!(flat.exists());

        save_suggestion(&scan_id, &sample_suggestion(7)).unwrap();

        // Legacy flat file is gone; history folder has v1 (migrated) + v2 (new).
        assert!(!flat.exists(), "legacy flat file should be migrated away");
        let history = list_suggestion_versions(&scan_id, 7).unwrap();
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].version, 2, "newest first");
        assert_eq!(history[1].version, 1, "legacy file mapped to v1");

        let scan_dir = scans_dir().unwrap().join(&scan_id);
        let _ = std::fs::remove_dir_all(&scan_dir);
    }

    #[test]
    fn list_suggestion_versions_surfaces_legacy_flat_as_v1() {
        // Legacy-only state (no re-save yet): list_suggestion_versions
        // must still return the flat file as v1 so the version picker
        // can open it even before the user re-studies.
        let scan_id = format!("drift-legacy-readonly-test-{}", uuid::Uuid::new_v4());
        let dir = suggestions_dir(&scan_id).unwrap();
        let flat = dir.join("0.json");
        std::fs::write(&flat, serde_json::to_vec_pretty(&sample_suggestion(0)).unwrap()).unwrap();

        let history = list_suggestion_versions(&scan_id, 0).unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].version, 1);

        let scan_dir = scans_dir().unwrap().join(&scan_id);
        let _ = std::fs::remove_dir_all(&scan_dir);
    }

    #[test]
    fn list_suggestion_versions_empty_when_never_studied() {
        let scan_id = format!("drift-novers-test-{}", uuid::Uuid::new_v4());
        let v = list_suggestion_versions(&scan_id, 0).unwrap();
        assert!(v.is_empty());
    }

    #[test]
    fn list_saved_suggestions_returns_empty_for_unknown_scan() {
        let scan_id = format!("drift-empty-test-{}", uuid::Uuid::new_v4());
        let v = list_saved_suggestions(&scan_id).expect("missing dir must not error");
        assert!(v.is_empty());
    }

    #[test]
    fn list_saved_suggestions_sorts_by_index() {
        let scan_id = format!("drift-sort-test-{}", uuid::Uuid::new_v4());
        // Persist in scrambled order; the listing should still return them
        // by ascending index so the UI's `rowsRef.set(index, ...)` lookups
        // never depend on filesystem readdir order.
        for idx in [5usize, 1, 3] {
            save_suggestion(&scan_id, &sample_suggestion(idx)).unwrap();
        }

        let listed = list_saved_suggestions(&scan_id).unwrap();
        assert_eq!(
            listed.iter().map(|s| s.index).collect::<Vec<_>>(),
            vec![1, 3, 5]
        );

        // Cleanup.
        let dir = scans_dir().unwrap().join(&scan_id);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_path_traversal_in_suggestions_dir() {
        assert!(suggestions_dir("../boom").is_err());
        assert!(suggestions_dir("").is_err());
        assert!(list_saved_suggestions("a/b").is_err());
    }

    #[test]
    fn round_trips_picker_roots() {
        let scan_id = format!("drift-pickerroots-test-{}", uuid::Uuid::new_v4());
        let report = fixture();
        let roots = vec![
            ScanPickerRoot {
                index: 0,
                name: "main".into(),
                file: "src/main.rs".into(),
                line: 12,
                reach: 42,
                callers: vec![super::super::types::ScanPickerCaller {
                    name: "<module>".into(),
                    file: "src/main.rs".into(),
                    line: 1,
                }],
            },
            ScanPickerRoot {
                index: 1,
                name: "worker".into(),
                file: "src/worker.rs".into(),
                line: 8,
                reach: 17,
                callers: vec![],
            },
        ];

        let saved = save_report(&scan_id, &report, &roots).unwrap();
        let stored = load_envelope(&scan_id).unwrap();
        assert_eq!(stored.picker_roots.len(), 2);
        assert_eq!(stored.picker_roots[0].name, "main");
        assert_eq!(stored.picker_roots[0].callers[0].name, "<module>");
        assert_eq!(stored.picker_roots[1].reach, 17);

        let _ = std::fs::remove_file(&saved);
    }
}
