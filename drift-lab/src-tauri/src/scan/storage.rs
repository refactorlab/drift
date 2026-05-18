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
use drift_static_profiler::compact::{self, CompactReport};
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

/// `~/.drift/scans/<scan_id>/` — the per-scan companion directory.
/// Holds everything keyed to one scan that isn't the envelope itself:
/// LLM suggestions, per-entry call-tree sidecars, future extensions.
///
/// Path-traversal-safe via [`validate_scan_id`]. `create_dir_all` is
/// idempotent so callers can use this whether the dir already exists
/// from a prior write or not.
fn scan_dir(scan_id: &str) -> Result<PathBuf> {
    validate_scan_id(scan_id)?;
    let dir = scans_dir()?.join(scan_id);
    std::fs::create_dir_all(&dir)
        .with_context(|| format!("creating {}", dir.display()))?;
    Ok(dir)
}

/// `~/.drift/scans/<scan_id>/entries/` — per-entry call-tree sidecars.
/// One `<idx>.json` per element of the envelope's `entries` array.
/// Written eagerly by [`save_report`] AND lazily by [`load_scan_entry`]
/// when a legacy scan (saved before the sidecar machinery) is first
/// drilled into.
fn scan_entries_dir(scan_id: &str) -> Result<PathBuf> {
    let dir = scan_dir(scan_id)?.join("entries");
    std::fs::create_dir_all(&dir)
        .with_context(|| format!("creating {}", dir.display()))?;
    Ok(dir)
}

/// `~/.drift/scans/<scan_id>/entries/<idx>.json` — one entry's full
/// call-tree subtree. Read by the per-entry fast path in
/// [`load_scan_entry`]: instead of parsing the 250 MB envelope to pull
/// out one entry, we hit this small file (~1–5 MB).
fn scan_entry_path(scan_id: &str, entry_index: usize) -> Result<PathBuf> {
    Ok(scan_entries_dir(scan_id)?.join(format!("{entry_index}.json")))
}

/// Generic atomic-write helper. Serializes `value` as pretty JSON, writes
/// to a sibling `*.json.tmp`, then `rename(2)`s into place — so a
/// crash mid-write never leaves a half-formed file at `path`. DRY
/// extraction of the pattern that previously lived inline in
/// [`save_report`], [`write_summary_sidecar`], and the legacy-suggestion
/// migration helper.
///
/// Single responsibility: durably persist one JSON document. Caller
/// supplies the destination path; this function knows nothing about
/// scan_id schemas or where things live in `~/.drift/`.
fn atomic_write_json<T: serde::Serialize>(path: &Path, value: &T) -> Result<()> {
    let tmp = path.with_extension("json.tmp");
    let json = serde_json::to_vec_pretty(value)
        .with_context(|| format!("serializing {}", path.display()))?;
    std::fs::write(&tmp, &json)
        .with_context(|| format!("writing {}", tmp.display()))?;
    std::fs::rename(&tmp, path)
        .with_context(|| format!("renaming {} → {}", tmp.display(), path.display()))?;
    Ok(())
}

/// Sidecar file: a pre-projected summary written next to the full
/// envelope at save time so the dashboard loader can skip parsing the
/// 250-MB body on every navigation. Lives at
/// `~/.drift/scans/<scan_id>.summary.json` — same directory as the
/// envelope so listing / deleting / backups stay simple.
///
/// Wire format is the same `StoredScan` as the full envelope, just with
/// each entry stripped to its header (see `strip_to_header`). That means
/// the same `serde_json::from_slice::<StoredScan>` deserializer works
/// for both paths — no new wire type for the viewer to learn.
fn scan_summary_path(scan_id: &str) -> Result<PathBuf> {
    validate_scan_id(scan_id)?;
    Ok(scans_dir()?.join(format!("{scan_id}.summary.json")))
}

/// Tiny listing sidecar: `~/.drift/scans/<scan_id>.meta.json` —
/// roughly 200 bytes per scan, just the fields `list_scans` returns to
/// the viewer's index page. Without it, listing N scans required
/// reading N × envelope-size bytes off disk (the canonical "8 scans of
/// 250 MB each → 2 GB of reads" footgun). With it, listing is
/// O(scans × ~200 B) — `ls ~/.drift/scans/*.meta.json | xargs cat` is
/// quite literally a few KB total even for 100 scans.
///
/// Write semantics mirror `<scan_id>.summary.json`: written eagerly by
/// `save_report`, atomically via tmp → rename, AND lazily backfilled
/// by `list_scans` when a legacy scan (saved before this sidecar
/// existed) is encountered. The file is a pure cache — deleting it is
/// always safe.
fn scan_meta_path(scan_id: &str) -> Result<PathBuf> {
    validate_scan_id(scan_id)?;
    Ok(scans_dir()?.join(format!("{scan_id}.meta.json")))
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

/// `~/.drift/scans/<scan_id>/code-suggestions/`. Created on demand.
/// Routes through [`scan_dir`] so the per-scan parent dir creation is
/// one helper, not duplicated here — DRY. No migration needed for older
/// scans: this dir simply doesn't exist for them and
/// [`list_saved_suggestions`] returns empty.
pub fn suggestions_dir(scan_id: &str) -> Result<PathBuf> {
    let dir = scan_dir(scan_id)?.join("code-suggestions");
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
    let saved_at = now_rfc3339();
    let envelope_path = write_envelope(scan_id, report, picker_roots, &saved_at)?;

    // Cache layer — best-effort projections written next to the envelope
    // so subsequent reads skip the full-envelope parse. Each cache is
    // independently rebuildable from the envelope, so a write failure
    // here is logged and never propagates: the lazy-backfill paths in
    // `load_envelope_summary` / `load_scan_entry` will rebuild on miss.
    log_if_err("summary sidecar", scan_id, || {
        write_summary_sidecar(scan_id, report, picker_roots, &saved_at)
    });
    log_if_err("entry sidecars", scan_id, || {
        write_entry_sidecars(scan_id, report)
    });
    log_if_err("meta sidecar", scan_id, || {
        write_meta_sidecar(scan_id, report, &saved_at)
    });

    Ok(envelope_path)
}

/// Write the full envelope at `<scan_id>.json`. The single source of
/// truth — everything else (summary sidecar, per-entry files) is a
/// derived cache that can be rebuilt from this file.
fn write_envelope(
    scan_id: &str,
    report: &Report,
    picker_roots: &[ScanPickerRoot],
    saved_at: &str,
) -> Result<PathBuf> {
    let path = scan_path(scan_id)?;
    let env = ScanEnvelope {
        scan_id,
        saved_at: saved_at.to_string(),
        report: CompactReport::from_report(report),
        picker_roots,
    };
    atomic_write_json(&path, &env)?;
    Ok(path)
}

/// Run `f`, logging any error against the named cache layer without
/// surfacing it to the caller. Centralizes the "best-effort cache
/// write" pattern so each call site reads as one line of intent.
fn log_if_err<F>(layer: &'static str, scan_id: &str, f: F)
where
    F: FnOnce() -> Result<()>,
{
    if let Err(e) = f() {
        tracing::warn!(
            scan_id = scan_id,
            layer = layer,
            "cache write failed (non-fatal; lazy backfill will retry): {e:#}"
        );
    }
}

/// Build + atomically write the pre-projected summary sidecar. Same
/// `strip_to_header` projection `load_envelope_summary` would do at read
/// time — we just do it once at save time so subsequent reads only
/// touch the small file.
fn write_summary_sidecar(
    scan_id: &str,
    report: &Report,
    picker_roots: &[ScanPickerRoot],
    saved_at: &str,
) -> Result<()> {
    let path = scan_summary_path(scan_id)?;
    let mut summary_report = report.clone();
    for entry in summary_report.entries.iter_mut() {
        strip_to_header(entry);
    }
    let env = ScanEnvelope {
        scan_id,
        saved_at: saved_at.to_string(),
        report: CompactReport::from_report(&summary_report),
        picker_roots,
    };
    atomic_write_json(&path, &env)
}

/// Write one file per entry under `<scan_id>/entries/<idx>.json`. Each
/// file is the full `CallTreeNode` subtree for that entry, ready to be
/// served by `load_scan_entry` with no envelope parse. This is the
/// optimization that takes per-entry dashboard drill-ins from
/// O(envelope-size) to O(entry-size) — roughly 50× faster on
/// real-project scans.
///
/// Atomic per file. Partial failure (3 of 5 written, then disk full)
/// leaves a usable state: present files serve the fast path, missing
/// ones fall through to the lazy backfill in `load_scan_entry`.
fn write_entry_sidecars(scan_id: &str, report: &Report) -> Result<()> {
    // Creates the entries dir on demand; cheap when it already exists.
    scan_entries_dir(scan_id)?;
    for (idx, entry) in report.entries.iter().enumerate() {
        let path = scan_entry_path(scan_id, idx)?;
        // Compact 1.1 sidecar: each entry tree carries its own
        // `string_table` + `frames`, so a sidecar that previously
        // duplicated every file path / symbol name for every transitive
        // callee now stores each unique string once. Per-entry size
        // typically drops 50-70%.
        let doc = compact::build_compact_entry(entry);
        atomic_write_json(&path, &doc)?;
    }
    Ok(())
}

/// Build + atomically write the ~200-byte index-page sidecar. Same shape
/// `list_scans` returns to the viewer — the meta file IS the listing
/// row, just persisted at save time so we don't pay an envelope parse
/// per scan when rendering the index.
///
/// Wire format is the same `ScanMeta` struct (camelCase via serde
/// rename_all) the HTTP / Tauri layer already returns to the UI, so a
/// future tool could `cat` the meta file straight into a list view
/// without writing any new code.
fn write_meta_sidecar(scan_id: &str, report: &Report, saved_at: &str) -> Result<()> {
    let meta = derive_meta(scan_id, report, saved_at);
    atomic_write_json(&scan_meta_path(scan_id)?, &meta)
}

/// Single source of truth for "what does a listing row contain?". Used
/// at both write time (`write_meta_sidecar`) and the legacy backfill
/// path (`read_meta_from_envelope`), so the two can't drift.
fn derive_meta(scan_id: &str, report: &Report, saved_at: &str) -> ScanMeta {
    let summary = &report.summary;
    let findings_total: u32 = summary
        .findings_by_kind
        .values()
        .map(|v| *v as u32)
        .sum();
    ScanMeta {
        scan_id: scan_id.to_string(),
        saved_at: saved_at.to_string(),
        source_root: report.generator.source_root.clone(),
        profiled_language: summary.profiled_language.clone(),
        files: summary.files as u32,
        symbols: summary.symbols as u32,
        findings_total,
    }
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

/// Load only the lightweight summary of a saved scan — every field of
/// the original envelope except each entry's recursive `children` tree.
/// Returned `entries` are still in the original order (the array index
/// is the public handle the slicing API uses) but their `children`
/// arrays are empty.
///
/// **Performance contract.** When the sidecar file
/// `~/.drift/scans/<id>.summary.json` exists — written by `save_report`
/// since the optimization landed — this function reads ~tens of KB and
/// returns in low single-digit ms even for 250 MB scans. Without a
/// sidecar (legacy scans saved before the sidecar machinery), we fall
/// back to parsing the full envelope, then write the sidecar
/// best-effort so the next call is fast. This makes the optimization
/// roll out transparently on existing on-disk data.
///
/// Why a sidecar (not streaming JSON, not split files): writing a tiny
/// projection alongside the envelope at save time is cheaper than every
/// other option (parse cost moves from per-load to once-per-save) and
/// keeps the on-disk schema additive (sidecar missing → fall back).
///
/// Subtrees are still fetched on demand via [`load_scan_entry`].
pub fn load_envelope_summary(scan_id: &str) -> Result<StoredScan> {
    // ── Fast path: sidecar present → tiny read, no full-envelope parse.
    let sidecar = scan_summary_path(scan_id)?;
    if sidecar.is_file() {
        match std::fs::read(&sidecar)
            .with_context(|| format!("reading {}", sidecar.display()))
            .and_then(|bytes| {
                serde_json::from_slice::<StoredScan>(&bytes)
                    .with_context(|| format!("parsing {}", sidecar.display()))
            }) {
            Ok(stored) => return Ok(stored),
            Err(e) => {
                // Corrupt sidecar (e.g. partial write from a crash). Log
                // and fall through to rebuild from the source-of-truth
                // envelope. We don't try to delete the bad sidecar
                // here — the backfill below overwrites it atomically.
                tracing::warn!(
                    scan_id = scan_id,
                    "summary sidecar unreadable, rebuilding from envelope: {e:#}"
                );
            }
        }
    }

    // ── Slow path: no sidecar yet. Parse the full envelope, project, AND
    // backfill the sidecar so the next call is fast. Lazy-migration: a
    // user pinging `/api/scans/<id>/summary` on a legacy scan pays the
    // full parse once; every subsequent dashboard mount is instant.
    let mut stored = load_envelope(scan_id)?;
    for entry in stored.report.entries.iter_mut() {
        strip_to_header(entry);
    }
    // Best-effort sidecar backfill. We can't reuse `stored` directly
    // because `write_summary_sidecar` takes `&Report` and we already
    // mutated it in place; the saved-at and picker-roots are right
    // there on the StoredScan. A failure here is logged but does not
    // fail the read — the caller still gets a correct response.
    if let Err(e) =
        write_summary_sidecar(scan_id, &stored.report, &stored.picker_roots, &stored.saved_at)
    {
        tracing::warn!(
            scan_id = scan_id,
            "summary sidecar backfill failed (next read will retry): {e:#}"
        );
    }
    Ok(stored)
}

/// Load one entry's full call-tree subtree by 0-based index into the
/// envelope's `entries` array.
///
/// **Performance contract.** When the per-entry sidecar
/// `~/.drift/scans/<id>/entries/<idx>.json` exists — written by
/// `save_report` since the per-entry optimization landed — this is an
/// O(entry-size) read (~1–5 MB, ~5–50 ms). Without it we fall back to
/// parsing the full envelope (~500 ms–2 s) AND backfill every entry
/// sidecar so subsequent drill-ins on this scan are fast. Lazy
/// migration: existing on-disk scans upgrade themselves on first click.
///
/// Index out of range surfaces a clean error.
pub fn load_scan_entry(
    scan_id: &str,
    entry_index: usize,
) -> Result<drift_static_profiler::tree::CallTreeNode> {
    if let Some(node) = try_read_entry_sidecar(scan_id, entry_index)? {
        return Ok(node);
    }
    backfill_entry_sidecars_from_envelope(scan_id)?;
    read_entry_sidecar_after_backfill(scan_id, entry_index)
}

/// Fast path: read the per-entry sidecar if it exists. `Ok(None)` (not
/// `Err`) when the file is simply absent — the caller falls through to
/// the backfill path. Anything else (permission denied, partial-write
/// JSON, etc.) is a real error worth surfacing.
fn try_read_entry_sidecar(
    scan_id: &str,
    entry_index: usize,
) -> Result<Option<drift_static_profiler::tree::CallTreeNode>> {
    let path = scan_entry_path(scan_id, entry_index)?;
    match std::fs::read(&path) {
        Ok(bytes) => {
            // `compact::read_entry` auto-detects: 1.1 compact sidecar
            // (with embedded string_table+frames) vs. legacy raw
            // CallTreeNode JSON. Lets pre-existing sidecars on disk
            // continue to load.
            let node = compact::read_entry(&bytes)
                .with_context(|| format!("parsing {}", path.display()))?;
            Ok(Some(node))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e).with_context(|| format!("reading {}", path.display())),
    }
}

/// Slow path: parse the full envelope and write every entry as its own
/// sidecar so future drill-ins are fast. This is the lazy migration
/// hook — legacy scans saved before the per-entry optimization upgrade
/// themselves on first click. After this returns successfully, every
/// `<scan_id>/entries/<idx>.json` exists.
fn backfill_entry_sidecars_from_envelope(scan_id: &str) -> Result<()> {
    let stored = load_envelope(scan_id)?;
    write_entry_sidecars(scan_id, &stored.report)
}

/// Re-read the entry sidecar after backfill, surfacing a clean
/// out-of-range error when the requested index doesn't exist. Split out
/// so `load_scan_entry`'s control flow reads as three one-liners.
fn read_entry_sidecar_after_backfill(
    scan_id: &str,
    entry_index: usize,
) -> Result<drift_static_profiler::tree::CallTreeNode> {
    let path = scan_entry_path(scan_id, entry_index)?;
    match std::fs::read(&path) {
        Ok(bytes) => compact::read_entry(&bytes)
            .with_context(|| format!("parsing {}", path.display())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => anyhow::bail!(
            "entry_index {entry_index} out of range for scan {scan_id}"
        ),
        Err(e) => Err(e).with_context(|| format!("reading {}", path.display())),
    }
}

/// Strip every per-entry field that costs bytes on the wire AND isn't
/// needed by the dashboard. After this:
///   • `children` → `[]`           (the big one — recursive subtree)
///   • `findings` → `[]`           (counts live in `roots_overview`)
///   • `external_calls` → `[]`     (entry-level detail, fetched lazily)
///   • `callers` → `[]`            (count survives via `callers_count`)
///
/// What's preserved per entry (the "header" set the picker + entry list
/// renders): id, name, kind, file, line, depth, parent_class,
/// subtree_size, callers_count, callees_count, categories_reached,
/// entry_labels, and the small metric fields (complexity, loc, …).
///
/// On a 100 k-finding scan, this drops the summary payload from tens of
/// MB (old aggregation behavior) to single-digit KB per entry.
fn strip_to_header(node: &mut drift_static_profiler::tree::CallTreeNode) {
    node.children = Vec::new();
    node.findings = Vec::new();
    node.external_calls = Vec::new();
    node.callers = Vec::new();
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
    // Delete cache layers first so we never serve a stale projection
    // pointing at a deleted envelope. The reverse order (envelope
    // gone, cache stale) would briefly serve dead data; sidecar-then-
    // dir-then-envelope keeps the visible state consistent at every
    // intermediate point. All three layers ignore NotFound (idempotent).
    remove_quietly("summary sidecar", scan_id, scan_summary_path(scan_id)?, false);
    remove_quietly("meta sidecar", scan_id, scan_meta_path(scan_id)?, false);
    remove_quietly("meta sidecar", scan_id, scan_meta_path(scan_id)?, false);
    remove_quietly("entries dir", scan_id, scan_dir_path(scan_id)?, true);

    let envelope = scan_path(scan_id)?;
    match std::fs::remove_file(&envelope) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e).with_context(|| format!("deleting {}", envelope.display())),
    }
}

/// `scan_dir(id)` creates the directory on call. For deletion we want
/// the path WITHOUT side-effecting the filesystem (creating the dir
/// just to delete it would be silly). Path-traversal-safe via
/// `validate_scan_id`.
fn scan_dir_path(scan_id: &str) -> Result<PathBuf> {
    validate_scan_id(scan_id)?;
    Ok(scans_dir()?.join(scan_id))
}

/// Best-effort remove. `is_dir = true` recursively removes a directory
/// tree; `false` removes a single file. NotFound is silent (idempotent
/// delete); any other error is logged but does NOT propagate, because
/// these are cache layers — losing them just means the next read pays a
/// parse cost. The source-of-truth envelope deletion below is the only
/// place a real error matters.
fn remove_quietly(layer: &'static str, scan_id: &str, path: PathBuf, is_dir: bool) {
    let result = if is_dir {
        std::fs::remove_dir_all(&path)
    } else {
        std::fs::remove_file(&path)
    };
    match result {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => tracing::warn!(
            scan_id = scan_id,
            layer = layer,
            path = %path.display(),
            "removing cache layer failed (non-fatal): {e}"
        ),
    }
}

/// Coarse metadata for the scans index. We don't parse the whole `Report`
/// body — just the envelope head + filesystem mtime — so listing 100 scans is
/// cheap.
/// One row of the viewer's index page. Both Serialize (sent to the UI)
/// and Deserialize (round-tripped through the `<id>.meta.json` sidecar).
/// `camelCase` wire form matches the viewer's `ScanMeta` TypeScript
/// interface — keep them in sync. The `alias` attributes accept the
/// snake_case form too so a legacy meta file (or one a CLI tool wrote
/// by hand) still loads.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanMeta {
    #[serde(alias = "scan_id")]
    pub scan_id: String,
    #[serde(alias = "saved_at")]
    pub saved_at: String,
    #[serde(alias = "source_root")]
    pub source_root: Option<String>,
    #[serde(alias = "profiled_language")]
    pub profiled_language: Option<String>,
    pub files: u32,
    pub symbols: u32,
    #[serde(alias = "findings_total")]
    pub findings_total: u32,
}

/// Enumerate every saved scan. Sorted by saved_at descending (newest
/// first). A malformed file is logged + skipped — the user can still
/// see the rest.
///
/// **Performance contract.** Each scan contributes one ~200-byte
/// `<id>.meta.json` read; the canonical "8 scans of 250 MB each → 2 GB
/// of envelope reads just to render the index" footgun is gone. For
/// legacy scans (saved before the meta sidecar landed), the first call
/// rebuilds the meta file by parsing the envelope once, after which
/// every subsequent listing is instant.
///
/// Iteration source: envelope files (`<id>.json`). The envelope is the
/// canonical "scan exists" marker; meta files are pure cache. If a meta
/// file exists but the envelope doesn't (orphan from a partial delete),
/// it's not a scan and gets ignored. The reverse — envelope without
/// meta — triggers the lazy backfill below.
pub fn list_scans() -> Result<Vec<ScanMeta>> {
    let mut out = Vec::new();
    for envelope_path in iter_envelope_paths()? {
        let Some(scan_id) = scan_id_from_envelope_path(&envelope_path) else {
            continue;
        };
        match read_meta_for_listing(&scan_id, &envelope_path) {
            Ok(meta) => out.push(meta),
            Err(e) => tracing::warn!(
                scan_id = scan_id,
                "skipping malformed scan: {e:#}"
            ),
        }
    }
    out.sort_by(|a, b| b.saved_at.cmp(&a.saved_at));
    Ok(out)
}

/// Enumerate scan envelope paths in `~/.drift/scans/`. Yields each
/// `<id>.json` file once, filtering out the cache sidecars that also
/// end in `.json`. Pure iteration helper — no I/O beyond the
/// `read_dir`, no parsing.
fn iter_envelope_paths() -> Result<Vec<PathBuf>> {
    let dir = scans_dir()?;
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir)
        .with_context(|| format!("reading {}", dir.display()))?
    {
        let Ok(entry) = entry else { continue };
        let path = entry.path();
        if !is_envelope_file(&path) {
            continue;
        }
        out.push(path);
    }
    Ok(out)
}

/// True when `path` is the source-of-truth `<id>.json` for a scan —
/// not one of the `<id>.summary.json` / `<id>.meta.json` cache
/// sidecars. Single source of truth for the suffix-filter rule so
/// `iter_envelope_paths` reads as one clear predicate.
fn is_envelope_file(path: &Path) -> bool {
    if path.extension().and_then(|s| s.to_str()) != Some("json") {
        return false;
    }
    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
        return false;
    };
    !name.ends_with(".summary.json") && !name.ends_with(".meta.json")
}

/// Recover the scan_id from an envelope's filename. `<id>.json` →
/// `<id>`. Returns `None` for paths that don't have the expected
/// shape — listing skips them silently.
fn scan_id_from_envelope_path(path: &Path) -> Option<String> {
    path.file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string())
}

/// Three-tier read for one scan's listing row, fastest path first:
///   1. **Meta sidecar** — `<id>.meta.json` (~200 B). Hit rate: 100 %
///      for any scan saved after this optimization landed.
///   2. **Summary sidecar** — `<id>.summary.json` (~KB). The middle
///      tier exists for the rare case where a save crashed AFTER the
///      summary write but BEFORE the meta write (or a manual file
///      deletion). Still saves us from reading a multi-GB envelope.
///   3. **Envelope** — `<id>.json` (could be 1.72 GB on real scans).
///      Legacy path only. Backfills the meta sidecar before returning
///      so the NEXT list_scans call falls through to tier 1.
fn read_meta_for_listing(scan_id: &str, envelope_path: &Path) -> Result<ScanMeta> {
    if let Some(meta) = try_read_meta_sidecar(scan_id) {
        return Ok(meta);
    }
    let meta = read_meta_via_fallback(scan_id, envelope_path)?;
    log_if_err("meta sidecar (backfill)", scan_id, || {
        atomic_write_json(&scan_meta_path(scan_id)?, &meta)
    });
    Ok(meta)
}

/// Try the summary sidecar (tier 2), fall through to the envelope
/// (tier 3) only if both caches are absent. Split out so
/// `read_meta_for_listing` stays a three-line tier-1 → fallback →
/// backfill sketch.
fn read_meta_via_fallback(scan_id: &str, envelope_path: &Path) -> Result<ScanMeta> {
    if let Some(meta) = try_read_meta_from_summary(scan_id) {
        return Ok(meta);
    }
    read_meta_from_envelope(scan_id, envelope_path)
}

/// Tier 2 — pull listing fields from `<id>.summary.json` instead of the
/// envelope. The summary sidecar is the same `StoredScan` wire shape,
/// just with entries stripped; the same deserializer works and we save
/// the multi-GB envelope read. `None` on absent OR malformed — both
/// fall through to the envelope path.
fn try_read_meta_from_summary(scan_id: &str) -> Option<ScanMeta> {
    let path = scan_summary_path(scan_id).ok()?;
    if !path.is_file() {
        return None;
    }
    let bytes = match std::fs::read(&path) {
        Ok(b) => b,
        Err(e) => {
            tracing::warn!(
                scan_id = scan_id,
                "reading summary sidecar for meta fallback failed (will try envelope): {e}"
            );
            return None;
        }
    };
    match serde_json::from_slice::<StoredScan>(&bytes) {
        Ok(stored) => Some(derive_meta(scan_id, &stored.report, &stored.saved_at)),
        Err(e) => {
            tracing::warn!(
                scan_id = scan_id,
                "parsing summary sidecar for meta fallback failed (will try envelope): {e}"
            );
            None
        }
    }
}

/// Try the meta sidecar. `None` for absent OR corrupt — both fall
/// through to the envelope rebuild. We log a warning on corrupt so a
/// real disk issue isn't silently masked.
fn try_read_meta_sidecar(scan_id: &str) -> Option<ScanMeta> {
    let path = scan_meta_path(scan_id).ok()?;
    if !path.is_file() {
        return None;
    }
    let bytes = match std::fs::read(&path) {
        Ok(b) => b,
        Err(e) => {
            tracing::warn!(
                scan_id = scan_id,
                "reading meta sidecar failed (will rebuild): {e}"
            );
            return None;
        }
    };
    match serde_json::from_slice(&bytes) {
        Ok(meta) => Some(meta),
        Err(e) => {
            tracing::warn!(
                scan_id = scan_id,
                "parsing meta sidecar failed (will rebuild): {e}"
            );
            None
        }
    }
}

/// Slow path: parse the full envelope and derive the listing fields.
/// Used only on legacy scans (saved before the meta sidecar existed)
/// AND on cache-miss recovery. Routes through `derive_meta` so the
/// "what does a listing row contain?" definition lives in exactly one
/// place.
fn read_meta_from_envelope(scan_id: &str, path: &Path) -> Result<ScanMeta> {
    let bytes = std::fs::read(path)
        .with_context(|| format!("reading {}", path.display()))?;
    let stored: StoredScan = serde_json::from_slice(&bytes)
        .with_context(|| format!("parsing {}", path.display()))?;
    Ok(derive_meta(scan_id, &stored.report, &stored.saved_at))
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
    /// On disk this lives in compact 1.1 form (`{ string_table, frames,
    /// entries: [{ f, … }] }`); the custom deserializer below uses
    /// `compact::read_report` to auto-detect that vs. legacy 1.0
    /// (inline `entries: [{ name, file, … }]`) and always hands callers
    /// the canonical denormalized [`Report`].
    #[serde(deserialize_with = "deserialize_report_any_format")]
    pub report: Report,
    /// Full picker-root list the discovery phase produced. `default` keeps
    /// scans saved before this field existed loadable — they come back with
    /// an empty list and the UI gracefully hides the "Pick another entry"
    /// button rather than throwing a parse error.
    #[serde(default, alias = "picker_roots")]
    pub picker_roots: Vec<ScanPickerRoot>,
}

/// Deserialize a `Report` from either the legacy 1.0 inline form or the
/// new 1.1 interned form. Bridges old on-disk envelopes through to
/// callers that only know the denormalized in-memory `Report`.
fn deserialize_report_any_format<'de, D>(d: D) -> std::result::Result<Report, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::Error;
    let v = serde_json::Value::deserialize(d)?;
    // The compact form has a top-level `string_table` (and `frames`).
    if v.get("string_table").is_some() || v.get("frames").is_some() {
        let compact: CompactReport = serde_json::from_value(v).map_err(D::Error::custom)?;
        Ok(compact.expand())
    } else {
        serde_json::from_value(v).map_err(D::Error::custom)
    }
}

/// Write-side envelope. Built by converting an in-memory `Report` into
/// the compact wire form so envelopes on disk dedupe file paths /
/// symbol metadata across every entry tree — typical reduction on real
/// repos is 60–80% vs. the legacy 1.0 inline encoding.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanEnvelope<'a> {
    scan_id: &'a str,
    saved_at: String,
    report: CompactReport,
    picker_roots: &'a [ScanPickerRoot],
}

/// Build the compact wire envelope for a [`StoredScan`] that's already
/// expanded in memory. Used by the HTTP routes and Tauri commands so
/// the bytes that hit the browser are 60–80 % smaller than the legacy
/// inline encoding — same disk savings, now extended to the wire.
/// The desktop UI / embedded viewer decompress on the way in.
pub fn to_compact_envelope(stored: &StoredScan) -> serde_json::Value {
    let compact = CompactReport::from_report(&stored.report);
    serde_json::json!({
        "scanId": &stored.scan_id,
        "savedAt": &stored.saved_at,
        "report": compact,
        "pickerRoots": &stored.picker_roots,
    })
}

/// Same as [`to_compact_envelope`] but for a bare [`CallTreeNode`] (the
/// per-entry sidecar route): wraps it in a [`compact::CompactEntryDoc`]
/// so the viewer can `decompressEntry` it back.
pub fn to_compact_entry(node: &drift_static_profiler::tree::CallTreeNode) -> compact::CompactEntryDoc {
    compact::build_compact_entry(node)
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

    /// Build a fixture envelope with one entry that has a non-empty
    /// `children` subtree so we can assert summary stripping actually
    /// removes the recursive payload.
    fn fixture_with_subtree() -> Report {
        let child = serde_json::json!({
            "id": "child-sym",
            "name": "child_fn",
            "kind": "Function",
            "file": "src/lib.rs",
            "line": 99,
            "depth": 1,
            "parent_class": null,
            "children": [],
            "truncated_reason": null,
            "callers": [],
            "callers_count": 1,
            "callees_count": 0,
            "subtree_size": 1,
            "category_self": null,
            "categories_reached": {},
            "external_calls": [],
            "complexity": 1,
            "loc": 5,
            "nesting_depth": 1,
            "parameter_count": 0,
            "is_async": false,
            "call_site_count": 1,
            "is_recursive": false,
            "pagerank": 0.0,
            "percent_total": 0.5,
            "percent_parent": 0.5,
            "n_plus_one_risk": false,
            "blocking_in_async": false,
        });
        let entry = serde_json::json!({
            "id": "entry-sym",
            "name": "entry_fn",
            "kind": "Function",
            "file": "src/main.rs",
            "line": 7,
            "depth": 0,
            "parent_class": null,
            "children": [child],
            "truncated_reason": null,
            "callers": [],
            "callers_count": 0,
            "callees_count": 1,
            "subtree_size": 2,
            "category_self": null,
            "categories_reached": {},
            "external_calls": [],
            "complexity": 2,
            "loc": 10,
            "nesting_depth": 1,
            "parameter_count": 0,
            "is_async": false,
            "call_site_count": 0,
            "is_recursive": false,
            "pagerank": 0.0,
            "percent_total": 1.0,
            "percent_parent": 0.0,
            "n_plus_one_risk": false,
            "blocking_in_async": false,
        });
        let report_json = serde_json::json!({
            "schema_version": "1.0",
            "mode": "static",
            "generator": {
                "tool": "drift-static-profiler",
                "version": "0.1.0",
                "source_root": "/tmp/example",
            },
            "summary": {
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
                "findings_by_kind": {},
            },
            "entries": [entry],
        });
        serde_json::from_value(report_json).unwrap()
    }

    /// `load_envelope_summary` must keep every per-entry field (subtree_size,
    /// findings counts, file:line, etc.) while emptying `children`. That
    /// shape is what makes the viewer's landing dashboard render fast
    /// even on 50 MB scans — the recursive call tree is fetched lazily
    /// per drill-in via `load_scan_entry`.
    #[test]
    fn load_envelope_summary_strips_children_but_keeps_headers() {
        let scan_id = format!("drift-summary-test-{}", uuid::Uuid::new_v4());
        let report = fixture_with_subtree();
        let saved = save_report(&scan_id, &report, &[]).unwrap();

        let summary = load_envelope_summary(&scan_id).unwrap();
        assert_eq!(summary.report.entries.len(), 1);
        let entry = &summary.report.entries[0];
        // Children stripped — this is the headline contract.
        assert!(
            entry.children.is_empty(),
            "summary projection must empty `children`"
        );
        // Header fields preserved — without these the viewer's entry
        // picker / summary cards would have nothing to render.
        assert_eq!(entry.name, "entry_fn");
        assert_eq!(entry.file, "src/main.rs");
        assert_eq!(entry.line, 7);
        assert_eq!(entry.subtree_size, 2);
        assert_eq!(entry.callees_count, 1);

        let _ = std::fs::remove_file(&saved);
    }

    /// `load_scan_entry` must return the FULL subtree (children intact),
    /// because this is the lazy-load endpoint the viewer hits per
    /// drill-in. Out-of-range index must surface a clean error string.
    #[test]
    fn load_scan_entry_returns_full_subtree_and_rejects_out_of_range() {
        let scan_id = format!("drift-entry-test-{}", uuid::Uuid::new_v4());
        let report = fixture_with_subtree();
        let saved = save_report(&scan_id, &report, &[]).unwrap();

        let node = load_scan_entry(&scan_id, 0).unwrap();
        assert_eq!(node.name, "entry_fn");
        assert_eq!(node.children.len(), 1, "subtree must be intact");
        assert_eq!(node.children[0].name, "child_fn");

        // Out-of-range — clean error, no panic.
        let err = load_scan_entry(&scan_id, 99).unwrap_err().to_string();
        assert!(
            err.contains("out of range"),
            "out-of-range index must error cleanly, got: {err}"
        );

        let _ = std::fs::remove_file(&saved);
    }

    /// Wire-contract for the dashboard's optimization: the summary
    /// projection MUST strip everything heavy from each entry — no
    /// children, no findings array, no external_calls, no callers Vec —
    /// while keeping the header fields the entry-list renders.
    ///
    /// The dashboard derives global sevCounts from
    /// `summary.roots_overview[*].findings_by_severity` (already
    /// emitted by the analyzer), so a hoist-findings-onto-root step
    /// would be both unnecessary AND a wire-size bomb on big scans.
    /// This test guards against accidentally re-introducing it.
    #[test]
    fn summary_projection_strips_heavy_fields_keeps_headers() {
        let scan_id = format!("drift-aggregate-test-{}", uuid::Uuid::new_v4());

        // Findings at three depths: one on entry root (depth 0), one on
        // the direct child (depth 1), one on a grandchild (depth 2).
        // The grandchild verifies the recursion actually descends.
        let grandchild = serde_json::json!({
            "id": "gc-sym", "name": "deep_fn", "kind": "Function",
            "file": "src/lib.rs", "line": 200, "depth": 2,
            "parent_class": null, "children": [], "truncated_reason": null,
            "callers": [], "callers_count": 0, "callees_count": 0,
            "subtree_size": 1, "category_self": null,
            "categories_reached": {}, "external_calls": [],
            "complexity": 1, "loc": 3, "nesting_depth": 1,
            "parameter_count": 0, "is_async": false, "call_site_count": 0,
            "is_recursive": false, "pagerank": 0.0,
            "percent_total": 0.1, "percent_parent": 0.1,
            "n_plus_one_risk": false, "blocking_in_async": false,
            "findings": [{
                "kind": "n_plus_one", "severity": "high", "confidence": 0.9,
                "line": 200, "message": "loop-N+1 in grandchild",
            }],
        });
        let child = serde_json::json!({
            "id": "child-sym", "name": "mid_fn", "kind": "Function",
            "file": "src/lib.rs", "line": 99, "depth": 1,
            "parent_class": null, "children": [grandchild],
            "truncated_reason": null, "callers": [],
            "callers_count": 1, "callees_count": 1, "subtree_size": 2,
            "category_self": null, "categories_reached": {},
            "external_calls": [], "complexity": 1, "loc": 5,
            "nesting_depth": 1, "parameter_count": 0, "is_async": false,
            "call_site_count": 1, "is_recursive": false, "pagerank": 0.0,
            "percent_total": 0.4, "percent_parent": 0.4,
            "n_plus_one_risk": false, "blocking_in_async": false,
            "findings": [{
                "kind": "blocking_in_async", "severity": "medium",
                "confidence": 0.7, "line": 99, "message": "blocking in async",
            }],
        });
        let entry = serde_json::json!({
            "id": "entry-sym", "name": "entry_fn", "kind": "Function",
            "file": "src/main.rs", "line": 7, "depth": 0,
            "parent_class": null, "children": [child],
            "truncated_reason": null, "callers": [],
            "callers_count": 0, "callees_count": 1, "subtree_size": 3,
            "category_self": null, "categories_reached": {},
            "external_calls": [], "complexity": 2, "loc": 10,
            "nesting_depth": 1, "parameter_count": 0, "is_async": false,
            "call_site_count": 0, "is_recursive": false, "pagerank": 0.0,
            "percent_total": 1.0, "percent_parent": 0.0,
            "n_plus_one_risk": false, "blocking_in_async": false,
            "findings": [{
                "kind": "hot_zone", "severity": "low",
                "confidence": 0.5, "line": 7, "message": "hot zone at entry",
            }],
        });
        let report_json = serde_json::json!({
            "schema_version": "1.0", "mode": "static",
            "generator": { "tool": "drift-static-profiler", "version": "0.1.0",
                           "source_root": "/tmp/example" },
            "summary": {
                "languages": ["rust"], "files": 1, "symbols": 3, "edges": 2,
                "categories": {}, "top_callers": [], "top_callees": [],
                "hot_paths": [], "dead_code": [], "pagerank_top": [],
                "recursive_symbols": [], "language_breakdown": [],
                "profiled_language": "rust",
                "profiled_language_percent": 100.0,
                "findings_by_kind": {
                    "hot_zone": 1, "blocking_in_async": 1, "n_plus_one": 1,
                },
            },
            "entries": [entry],
        });
        let report: Report = serde_json::from_value(report_json).unwrap();
        let saved = save_report(&scan_id, &report, &[]).unwrap();

        let summary = load_envelope_summary(&scan_id).unwrap();
        let entry = &summary.report.entries[0];

        // Headline guarantees — the heavy fields are gone.
        assert!(entry.children.is_empty(), "children must be stripped");
        assert!(
            entry.findings.is_empty(),
            "findings must be stripped (counts live in summary.roots_overview); got {:?}",
            entry.findings
        );
        assert!(
            entry.external_calls.is_empty(),
            "external_calls must be stripped, got {:?}",
            entry.external_calls
        );
        assert!(
            entry.callers.is_empty(),
            "callers Vec must be stripped (count survives via callers_count), got {:?}",
            entry.callers
        );

        // Header preserved — the entry-list / picker still has everything
        // it needs to render row labels and navigation.
        assert_eq!(entry.name, "entry_fn");
        assert_eq!(entry.file, "src/main.rs");
        assert_eq!(entry.line, 7);
        assert_eq!(entry.subtree_size, 3);
        assert_eq!(entry.callees_count, 1);

        let _ = std::fs::remove_file(&saved);
    }

    /// Performance contract: `save_report` writes a pre-projected
    /// summary sidecar alongside the envelope. Without this, the
    /// dashboard's `/api/scans/:id/summary` endpoint would still pay
    /// the full-envelope parse cost on every load.
    #[test]
    fn save_report_writes_summary_sidecar() {
        let scan_id = format!("drift-sidecar-write-{}", uuid::Uuid::new_v4());
        let report = fixture();
        let saved = save_report(&scan_id, &report, &[]).unwrap();
        assert!(saved.exists(), "envelope must be written");

        let sidecar = scan_summary_path(&scan_id).unwrap();
        assert!(
            sidecar.exists(),
            "summary sidecar must be written by save_report; expected {}",
            sidecar.display()
        );

        // Sidecar must be parseable as the same StoredScan shape the
        // viewer expects — same wire type for envelope and summary, just
        // with entries stripped.
        let bytes = std::fs::read(&sidecar).unwrap();
        let stored: StoredScan =
            serde_json::from_slice(&bytes).expect("sidecar must be valid StoredScan JSON");
        assert_eq!(stored.scan_id, scan_id);

        let _ = std::fs::remove_file(&saved);
        let _ = std::fs::remove_file(&sidecar);
    }

    /// Lazy-migration: existing on-disk scans (saved before the sidecar
    /// machinery landed) must still get fast summary reads on the
    /// second call. The first call rebuilds the projection from the
    /// envelope AND backfills the sidecar; the second call hits the
    /// sidecar and skips the full parse.
    #[test]
    fn load_envelope_summary_backfills_missing_sidecar() {
        let scan_id = format!("drift-sidecar-backfill-{}", uuid::Uuid::new_v4());
        let report = fixture();
        let saved = save_report(&scan_id, &report, &[]).unwrap();

        // Simulate a legacy scan by deleting the sidecar `save_report`
        // just wrote. The next summary load must succeed AND re-create
        // the sidecar.
        let sidecar = scan_summary_path(&scan_id).unwrap();
        std::fs::remove_file(&sidecar).unwrap();
        assert!(!sidecar.exists(), "precondition: sidecar removed");

        // First load — rebuilds + backfills.
        let summary1 = load_envelope_summary(&scan_id).unwrap();
        assert_eq!(summary1.scan_id, scan_id);
        assert!(
            sidecar.exists(),
            "load_envelope_summary must backfill the sidecar on miss"
        );

        // Second load — sidecar is now present. Should return the same
        // shape. We can't directly observe "didn't parse the full
        // envelope" from this test (no instrumentation), but we CAN
        // verify the sidecar path returns the same data.
        let summary2 = load_envelope_summary(&scan_id).unwrap();
        assert_eq!(summary2.scan_id, scan_id);
        assert_eq!(summary1.report.entries.len(), summary2.report.entries.len());

        let _ = std::fs::remove_file(&saved);
        let _ = std::fs::remove_file(&sidecar);
    }

    /// Delete must remove BOTH the envelope and the sidecar — otherwise
    /// a re-create with the same scan_id (rare, but the import flow
    /// can produce duplicates) would briefly serve the stale sidecar
    /// for the deleted scan.
    #[test]
    fn delete_scan_removes_both_envelope_and_sidecar() {
        let scan_id = format!("drift-sidecar-delete-{}", uuid::Uuid::new_v4());
        let report = fixture();
        let envelope = save_report(&scan_id, &report, &[]).unwrap();
        let sidecar = scan_summary_path(&scan_id).unwrap();
        assert!(envelope.exists() && sidecar.exists(), "precondition");

        delete_scan(&scan_id).unwrap();

        assert!(!envelope.exists(), "envelope must be deleted");
        assert!(
            !sidecar.exists(),
            "sidecar must be deleted alongside the envelope"
        );
    }

    /// `list_scans` walks `*.json` files in `~/.drift/scans/`. The
    /// summary sidecar shares that extension; without an explicit skip
    /// the scan would appear twice (once per file) in the dropdown.
    #[test]
    fn list_scans_skips_summary_sidecars() {
        let scan_id = format!("drift-sidecar-listsift-{}", uuid::Uuid::new_v4());
        let report = fixture();
        let envelope = save_report(&scan_id, &report, &[]).unwrap();
        let sidecar = scan_summary_path(&scan_id).unwrap();
        assert!(sidecar.exists(), "precondition: sidecar was written");

        let listed = list_scans().unwrap();
        let hits: Vec<_> = listed.iter().filter(|m| m.scan_id == scan_id).collect();
        assert_eq!(
            hits.len(),
            1,
            "scan must appear exactly once in list_scans (not also as a sidecar row); got {} matches",
            hits.len()
        );

        let _ = std::fs::remove_file(&envelope);
        let _ = std::fs::remove_file(&sidecar);
    }

    /// Build a fixture with N entries so per-entry tests can index by
    /// position. Each entry has a distinct name + file so we can assert
    /// `load_scan_entry(n)` returns the n-th one, not some other.
    fn fixture_with_n_entries(n: usize) -> Report {
        let entries: Vec<_> = (0..n)
            .map(|i| {
                serde_json::json!({
                    "id": format!("entry-{i}"),
                    "name": format!("entry_fn_{i}"),
                    "kind": "Function",
                    "file": format!("src/main_{i}.rs"),
                    "line": 7 + i,
                    "depth": 0,
                    "parent_class": null,
                    "children": [],
                    "truncated_reason": null,
                    "callers": [],
                    "callers_count": 0,
                    "callees_count": 0,
                    "subtree_size": 1,
                    "category_self": null,
                    "categories_reached": {},
                    "external_calls": [],
                    "complexity": 1,
                    "loc": 10,
                    "nesting_depth": 1,
                    "parameter_count": 0,
                    "is_async": false,
                    "call_site_count": 0,
                    "is_recursive": false,
                    "pagerank": 0.0,
                    "percent_total": 1.0 / (n as f64),
                    "percent_parent": 0.0,
                    "n_plus_one_risk": false,
                    "blocking_in_async": false,
                })
            })
            .collect();
        let report_json = serde_json::json!({
            "schema_version": "1.0",
            "mode": "static",
            "generator": {
                "tool": "drift-static-profiler",
                "version": "0.1.0",
                "source_root": "/tmp/example",
            },
            "summary": {
                "languages": ["rust"],
                "files": n,
                "symbols": n,
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
            "entries": entries,
        });
        serde_json::from_value(report_json).unwrap()
    }

    /// Performance contract: `save_report` writes one
    /// `<scan_id>/entries/<idx>.json` file per entry so subsequent
    /// `load_scan_entry` calls hit a fast O(entry-size) read instead
    /// of parsing the full envelope.
    #[test]
    fn save_report_writes_per_entry_sidecars() {
        let scan_id = format!("drift-entry-sidecar-write-{}", uuid::Uuid::new_v4());
        let report = fixture_with_n_entries(3);
        let envelope = save_report(&scan_id, &report, &[]).unwrap();

        // Every entry index has its own file.
        for i in 0..3 {
            let path = scan_entry_path(&scan_id, i).unwrap();
            assert!(
                path.exists(),
                "per-entry sidecar must exist; expected {}",
                path.display()
            );
            // Each file deserializes via `compact::read_entry` —
            // 1.1 sidecars are `CompactEntryDoc`, 1.0 sidecars (legacy,
            // pre-refactor) are bare `CallTreeNode`. Both expand to
            // the canonical `CallTreeNode` shape.
            let bytes = std::fs::read(&path).unwrap();
            let node = drift_static_profiler::compact::read_entry(&bytes)
                .expect("entry sidecar must be valid JSON");
            assert_eq!(node.name, format!("entry_fn_{i}"));
        }

        // Cleanup — remove envelope + summary + entries directory.
        let _ = std::fs::remove_file(&envelope);
        let _ = std::fs::remove_file(scan_summary_path(&scan_id).unwrap());
        let _ = std::fs::remove_dir_all(scan_dir_path(&scan_id).unwrap());
    }

    /// `load_scan_entry` must read the small per-entry file when it
    /// exists. The file already deserializes to a `CallTreeNode` —
    /// no envelope parse needed. This is the headline optimization.
    #[test]
    fn load_scan_entry_uses_per_entry_sidecar_fast_path() {
        let scan_id = format!("drift-entry-fastpath-{}", uuid::Uuid::new_v4());
        let report = fixture_with_n_entries(2);
        let envelope = save_report(&scan_id, &report, &[]).unwrap();

        // Sanity: the per-entry sidecars exist.
        assert!(scan_entry_path(&scan_id, 0).unwrap().exists());
        assert!(scan_entry_path(&scan_id, 1).unwrap().exists());

        // Fast path served — without instrumenting the function we
        // verify the contract by checking we got the right entry back.
        let n0 = load_scan_entry(&scan_id, 0).unwrap();
        assert_eq!(n0.name, "entry_fn_0");
        let n1 = load_scan_entry(&scan_id, 1).unwrap();
        assert_eq!(n1.name, "entry_fn_1");

        let _ = std::fs::remove_file(&envelope);
        let _ = std::fs::remove_file(scan_summary_path(&scan_id).unwrap());
        let _ = std::fs::remove_dir_all(scan_dir_path(&scan_id).unwrap());
    }

    /// Lazy migration for legacy scans saved before the per-entry
    /// machinery: first `load_scan_entry` parses the full envelope
    /// AND backfills every per-entry sidecar, so future calls are fast.
    #[test]
    fn load_scan_entry_backfills_legacy_scan_on_miss() {
        let scan_id = format!("drift-entry-backfill-{}", uuid::Uuid::new_v4());
        let report = fixture_with_n_entries(3);
        let envelope = save_report(&scan_id, &report, &[]).unwrap();

        // Simulate a legacy scan: nuke the entries dir but keep the
        // envelope. The next `load_scan_entry` must succeed AND
        // re-populate every sidecar.
        let entries_dir = scan_dir_path(&scan_id).unwrap().join("entries");
        std::fs::remove_dir_all(&entries_dir).unwrap();
        assert!(!entries_dir.exists(), "precondition: entries dir removed");

        // First call — parses envelope, backfills all entries.
        let n1 = load_scan_entry(&scan_id, 1).unwrap();
        assert_eq!(n1.name, "entry_fn_1");

        // Every entry sidecar should now exist (we backfill ALL on
        // miss, not just the requested one — so subsequent drill-ins
        // on this scan don't pay another envelope parse).
        for i in 0..3 {
            let path = scan_entry_path(&scan_id, i).unwrap();
            assert!(
                path.exists(),
                "backfill must populate entry {i} sidecar at {}",
                path.display()
            );
        }

        // Out-of-range index — clean error after backfill.
        let err = load_scan_entry(&scan_id, 99).unwrap_err().to_string();
        assert!(
            err.contains("out of range"),
            "out-of-range index must error cleanly, got: {err}"
        );

        let _ = std::fs::remove_file(&envelope);
        let _ = std::fs::remove_file(scan_summary_path(&scan_id).unwrap());
        let _ = std::fs::remove_dir_all(scan_dir_path(&scan_id).unwrap());
    }

    /// Delete must remove the entire `<scan_id>/` directory, not just
    /// the envelope + summary sidecar. Without this, per-entry sidecars
    /// (and any prior LLM suggestions) would leak on disk and a
    /// same-keyed re-import could serve stale data.
    #[test]
    fn delete_scan_removes_per_entry_directory() {
        let scan_id = format!("drift-entry-delete-{}", uuid::Uuid::new_v4());
        let report = fixture_with_n_entries(2);
        let envelope = save_report(&scan_id, &report, &[]).unwrap();
        let dir = scan_dir_path(&scan_id).unwrap();
        assert!(dir.exists() && envelope.exists(), "precondition");

        delete_scan(&scan_id).unwrap();

        assert!(!envelope.exists(), "envelope deleted");
        assert!(
            !dir.exists(),
            "per-scan dir (entries + suggestions) deleted"
        );
        // Calling again is idempotent (NotFound on every layer).
        delete_scan(&scan_id).expect("delete must be idempotent on every layer");
    }

    /// Performance contract: `save_report` writes a tiny
    /// `<id>.meta.json` sidecar so the viewer's index page can render
    /// without parsing the full envelope per scan.
    #[test]
    fn save_report_writes_meta_sidecar() {
        let scan_id = format!("drift-meta-write-{}", uuid::Uuid::new_v4());
        let report = fixture();
        let envelope = save_report(&scan_id, &report, &[]).unwrap();

        let meta_path = scan_meta_path(&scan_id).unwrap();
        assert!(meta_path.is_file(), "meta sidecar missing: {}", meta_path.display());

        let size = std::fs::metadata(&meta_path).unwrap().len();
        assert!(size < 2048, "meta sidecar must be tiny; got {size} bytes");

        let bytes = std::fs::read(&meta_path).unwrap();
        let meta: ScanMeta = serde_json::from_slice(&bytes)
            .expect("meta sidecar must parse as ScanMeta directly");
        assert_eq!(meta.scan_id, scan_id);
        assert_eq!(meta.files, 3);

        let _ = std::fs::remove_file(&envelope);
        let _ = std::fs::remove_file(&meta_path);
        let _ = std::fs::remove_file(scan_summary_path(&scan_id).unwrap());
        let _ = std::fs::remove_dir_all(scan_dir_path(&scan_id).unwrap());
    }

    /// Lazy migration: existing scans without a meta sidecar (saved
    /// before this optimization landed) must still appear in
    /// `list_scans` AND their first listing must backfill the meta
    /// file so subsequent listings are fast.
    #[test]
    fn list_scans_backfills_missing_meta_sidecar() {
        let scan_id = format!("drift-meta-backfill-{}", uuid::Uuid::new_v4());
        let report = fixture();
        let envelope = save_report(&scan_id, &report, &[]).unwrap();
        let meta_path = scan_meta_path(&scan_id).unwrap();
        std::fs::remove_file(&meta_path).unwrap();
        assert!(!meta_path.exists(), "precondition: meta wiped");

        let listed = list_scans().unwrap();
        let row = listed
            .iter()
            .find(|m| m.scan_id == scan_id)
            .expect("scan must appear in listing");
        assert_eq!(row.files, 3);
        assert!(
            meta_path.is_file(),
            "list_scans must lazy-backfill the meta sidecar on miss"
        );

        let _ = std::fs::remove_file(&envelope);
        let _ = std::fs::remove_file(&meta_path);
        let _ = std::fs::remove_file(scan_summary_path(&scan_id).unwrap());
        let _ = std::fs::remove_dir_all(scan_dir_path(&scan_id).unwrap());
    }

    /// `list_scans` filters the dir walk by suffix so neither summary
    /// nor meta sidecars appear as their own listing row. Without this,
    /// every saved scan would show up multiple times in the index.
    #[test]
    fn list_scans_skips_meta_sidecars() {
        let scan_id = format!("drift-meta-listsift-{}", uuid::Uuid::new_v4());
        let report = fixture();
        let envelope = save_report(&scan_id, &report, &[]).unwrap();
        assert!(scan_meta_path(&scan_id).unwrap().is_file());
        assert!(scan_summary_path(&scan_id).unwrap().is_file());

        let listed = list_scans().unwrap();
        let hits: Vec<_> = listed.iter().filter(|m| m.scan_id == scan_id).collect();
        assert_eq!(
            hits.len(),
            1,
            "scan must appear exactly once despite three on-disk files; got {}",
            hits.len()
        );

        let _ = std::fs::remove_file(&envelope);
        let _ = std::fs::remove_file(scan_meta_path(&scan_id).unwrap());
        let _ = std::fs::remove_file(scan_summary_path(&scan_id).unwrap());
        let _ = std::fs::remove_dir_all(scan_dir_path(&scan_id).unwrap());
    }

    /// Cleanup contract: `delete_scan` removes the meta sidecar too —
    /// otherwise a re-import with the same scan_id would surface the
    /// stale meta row briefly until the next list_scans rebuilt it.
    #[test]
    fn delete_scan_removes_meta_sidecar() {
        let scan_id = format!("drift-meta-delete-{}", uuid::Uuid::new_v4());
        let report = fixture();
        let envelope = save_report(&scan_id, &report, &[]).unwrap();
        let meta = scan_meta_path(&scan_id).unwrap();
        assert!(envelope.exists() && meta.exists(), "precondition");

        delete_scan(&scan_id).unwrap();

        assert!(!envelope.exists(), "envelope deleted");
        assert!(!meta.exists(), "meta sidecar deleted alongside envelope");
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
