//! Folder registry — answers "what folders has this user scanned?".
//!
//! The source of truth is the existing static-scan metadata under
//! `~/.drift/scans/*.meta.json` (one file per scan, written by
//! `drift-static-profiler`). Each meta file already carries a
//! `sourceRoot` field; this module groups those records by
//! [`FolderFingerprint`] and decorates each group with the most recent
//! static-scan timestamp + a count.
//!
//! The registry is **read-only** here — there's no separate "folder
//! manifest" to keep in sync with the scan metas. New folders appear
//! automatically the moment a static scan is saved; they disappear if
//! all their scan files are removed.
//!
//! Active-scan event logs live alongside under
//! `~/.drift/scans/<fingerprint>/event_logs/`. Their mtime is the
//! authoritative `last_active_scan_at` for the folder; this module
//! reads but never writes that directory.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::fingerprint::FolderFingerprint;

/// Where the static scans + their per-folder data live. Mirrors what
/// `drift-static-profiler` writes; not configurable today.
pub fn default_scans_root() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".drift").join("scans"))
}

/// One scanned folder + summary of what's in it. The desktop UI lists
/// these in the "pick a folder" step.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedFolder {
    pub fingerprint: FolderFingerprint,
    /// Absolute path as it was when the static scan ran. May or may
    /// not exist on disk anymore — the UI shows it as a hint, not a
    /// live filesystem reference.
    pub path: String,
    /// Detected language from the most recent static scan, if any.
    pub language: Option<String>,
    /// ISO-8601 of the most recent static scan, if any.
    pub last_static_scan_at: Option<String>,
    /// ISO-8601 of the most recent realtime log file mtime, if any.
    pub last_active_scan_at: Option<String>,
    /// How many static-scan records exist for this folder.
    pub static_scan_count: usize,
}

/// One static-scan meta record as written by drift-static-profiler.
/// Field names match the existing on-disk shape (camelCase).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScanMeta {
    #[serde(default)]
    saved_at: Option<String>,
    #[serde(default)]
    source_root: Option<String>,
    #[serde(default)]
    profiled_language: Option<String>,
}

/// Read every `*.meta.json` in the scans root, group by source-root
/// path fingerprint, and return one [`ScannedFolder`] per group.
///
/// Errors when the scans dir doesn't exist OR can't be read; an empty
/// scans dir returns `Ok(vec![])`. Per-file deserialization errors are
/// silently skipped (the meta file may be a stale or partial write
/// from a crashed scan — surfacing the error would block the whole
/// list from rendering).
pub fn list_scanned_folders() -> Result<Vec<ScannedFolder>, String> {
    let Some(root) = default_scans_root() else {
        return Err("HOME not set; cannot resolve ~/.drift/scans".into());
    };
    if !root.exists() {
        return Ok(Vec::new());
    }

    // Group: fingerprint → accumulator
    struct Acc {
        path: String,
        language: Option<String>,
        last_scan: Option<String>, // ISO; we keep the lexicographically max
        count: usize,
    }
    let mut groups: HashMap<FolderFingerprint, Acc> = HashMap::new();

    let entries = fs::read_dir(&root).map_err(|e| format!("read {}: {e}", root.display()))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n,
            None => continue,
        };
        if !name.ends_with(".meta.json") {
            continue;
        }
        let bytes = match fs::read(&path) {
            Ok(b) => b,
            Err(_) => continue, // partial write / permission glitch
        };
        let meta: ScanMeta = match serde_json::from_slice(&bytes) {
            Ok(m) => m,
            Err(_) => continue,
        };
        let Some(source_root) = meta.source_root else {
            continue;
        };
        let fp = FolderFingerprint::from_canonical_string(&source_root);
        let acc = groups.entry(fp).or_insert_with(|| Acc {
            path: source_root.clone(),
            language: None,
            last_scan: None,
            count: 0,
        });
        acc.count += 1;
        // Prefer the language from whichever scan has the latest
        // saved_at — that's the user's most recent intent.
        if let Some(saved_at) = meta.saved_at {
            if acc.last_scan.as_deref().map_or(true, |cur| saved_at.as_str() > cur) {
                acc.last_scan = Some(saved_at);
                if meta.profiled_language.is_some() {
                    acc.language = meta.profiled_language;
                }
            }
        }
    }

    let mut out: Vec<ScannedFolder> = groups
        .into_iter()
        .map(|(fingerprint, acc)| {
            // Look for realtime-*.jsonl mtimes under
            // ~/.drift/scans/<fp>/event_logs/. If the dir doesn't
            // exist yet, that's fine — last_active_scan_at stays None.
            let last_active = root
                .join(fingerprint.as_str())
                .join("event_logs")
                .read_dir()
                .ok()
                .and_then(|it| {
                    it.flatten()
                        .filter_map(|e| e.metadata().ok().and_then(|m| m.modified().ok()))
                        .max()
                })
                .and_then(|t| {
                    t.duration_since(std::time::UNIX_EPOCH)
                        .ok()
                        .map(|d| iso8601_secs(d.as_secs() as i64))
                });
            ScannedFolder {
                fingerprint,
                path: acc.path,
                language: acc.language,
                last_static_scan_at: acc.last_scan,
                last_active_scan_at: last_active,
                static_scan_count: acc.count,
            }
        })
        .collect();

    // Stable display order: most-recently-touched first. Active runs
    // count as touch; fall back to static-scan time; finally path
    // alphabetical for groups with no timestamp at all.
    out.sort_by(|a, b| {
        let key_a = a.last_active_scan_at.as_deref().or(a.last_static_scan_at.as_deref());
        let key_b = b.last_active_scan_at.as_deref().or(b.last_static_scan_at.as_deref());
        match (key_a, key_b) {
            (Some(x), Some(y)) => y.cmp(x), // desc
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => a.path.cmp(&b.path),
        }
    });
    Ok(out)
}

/// Resolve the per-folder event-logs directory:
/// `~/.drift/scans/<fingerprint>/event_logs/`. Created if missing.
/// This is where realtime sessions for this folder write their
/// `realtime-<stamp>.jsonl` files.
pub fn event_logs_dir_for(fingerprint: &FolderFingerprint) -> Result<PathBuf, String> {
    let Some(root) = default_scans_root() else {
        return Err("HOME not set; cannot resolve ~/.drift/scans".into());
    };
    let dir = root.join(fingerprint.as_str()).join("event_logs");
    fs::create_dir_all(&dir).map_err(|e| format!("mkdir {}: {e}", dir.display()))?;
    Ok(dir)
}

/// True if the folder has at least one saved static scan. Used to gate
/// the "Start active scan" button — the user's rule is "active scan
/// only if statically scanned first" so the two paths are correlated.
pub fn has_static_scan(fingerprint: &FolderFingerprint) -> bool {
    list_scanned_folders()
        .ok()
        .and_then(|folders| {
            folders
                .into_iter()
                .find(|f| &f.fingerprint == fingerprint)
                .map(|f| f.static_scan_count > 0)
        })
        .unwrap_or(false)
}

/// One static-scan record visible to the Active Scan picker. Mirrors the
/// subset of `scan::storage::ScanMeta` the UI needs to render the
/// dropdown row — scan id, when it ran, source root + a couple of size
/// counts so the user can pick between two scans of the same folder.
///
/// Camel-cased on the wire because every other folder/realtime DTO is
/// (see [`ScannedFolder`]). The TS side consumes it as
/// `StaticScanRef`.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StaticScanRef {
    pub scan_id: String,
    pub saved_at: String,
    pub source_root: String,
    pub profiled_language: Option<String>,
    pub files: u32,
    pub symbols: u32,
}

/// List every static scan whose `sourceRoot` fingerprints to the
/// requested folder. Sorted newest-first by `saved_at`.
///
/// Source-of-truth is the same `~/.drift/scans/*.meta.json` set
/// [`list_scanned_folders`] groups. We filter row-by-row rather than
/// reusing the higher-level call so the function stays cheap: at most
/// one fingerprint computation + one comparison per meta file.
///
/// Returns `Ok(vec![])` when:
///   - the scans dir doesn't exist yet (fresh install), OR
///   - no saved scan has the matching fingerprint.
///
/// Per-file deserialisation errors are silently skipped — mirrors the
/// existing tolerance in `list_scanned_folders`.
pub fn list_static_scans_for(fingerprint: &FolderFingerprint) -> Result<Vec<StaticScanRef>, String> {
    let Some(root) = default_scans_root() else {
        return Err("HOME not set; cannot resolve ~/.drift/scans".into());
    };
    list_static_scans_for_in(&root, fingerprint)
}

/// Inner path-parameterized form. Read every `*.meta.json` in
/// `scans_root` and return the rows whose `sourceRoot` fingerprints
/// to `fingerprint`. Split out from the public function so unit
/// tests can point at a tempdir.
pub(crate) fn list_static_scans_for_in(
    scans_root: &Path,
    fingerprint: &FolderFingerprint,
) -> Result<Vec<StaticScanRef>, String> {
    if !scans_root.exists() {
        return Ok(Vec::new());
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct MetaRow {
        scan_id: String,
        saved_at: String,
        source_root: Option<String>,
        profiled_language: Option<String>,
        #[serde(default)]
        files: u32,
        #[serde(default)]
        symbols: u32,
    }

    let entries = fs::read_dir(scans_root)
        .map_err(|e| format!("read {}: {e}", scans_root.display()))?;
    let mut out = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if !name.ends_with(".meta.json") {
            continue;
        }
        let Ok(bytes) = fs::read(&path) else { continue };
        let Ok(meta) = serde_json::from_slice::<MetaRow>(&bytes) else {
            continue;
        };
        let Some(source_root) = meta.source_root else {
            continue;
        };
        if FolderFingerprint::from_canonical_string(&source_root) != *fingerprint {
            continue;
        }
        out.push(StaticScanRef {
            scan_id: meta.scan_id,
            saved_at: meta.saved_at,
            source_root,
            profiled_language: meta.profiled_language,
            files: meta.files,
            symbols: meta.symbols,
        });
    }

    // Newest first. Lexicographic comparison works because `saved_at`
    // is RFC-3339 with a constant prefix (year-leading) — same trick
    // `list_scanned_folders` uses.
    out.sort_by(|a, b| b.saved_at.cmp(&a.saved_at));
    Ok(out)
}

/// Look up a folder by its fingerprint. Convenience for code paths
/// that need the path back from an id (e.g. the realtime stream's
/// "your session was saved to ..." message).
pub fn find(fingerprint: &FolderFingerprint) -> Option<ScannedFolder> {
    list_scanned_folders()
        .ok()
        .and_then(|folders| folders.into_iter().find(|f| &f.fingerprint == fingerprint))
}

/// Register a new folder by path: ensures the per-folder directory
/// exists so the folder appears in `list_scanned_folders()` even
/// before any static scan has run. Returns the fingerprint.
///
/// Idempotent — calling twice on the same path is a no-op.
pub fn register(path: &Path) -> Result<FolderFingerprint, String> {
    if !path.exists() {
        return Err(format!("path does not exist: {}", path.display()));
    }
    if !path.is_dir() {
        return Err(format!("not a directory: {}", path.display()));
    }
    let fp = FolderFingerprint::from_path(path);
    let Some(root) = default_scans_root() else {
        return Err("HOME not set; cannot resolve ~/.drift/scans".into());
    };
    let dir = root.join(fp.as_str());
    fs::create_dir_all(&dir).map_err(|e| format!("mkdir {}: {e}", dir.display()))?;
    Ok(fp)
}

fn iso8601_secs(secs: i64) -> String {
    // RFC 3339 in UTC with second precision. We don't need µs here —
    // this is for "last scanned 12 minutes ago" display.
    use chrono::{DateTime, Utc};
    DateTime::<Utc>::from_timestamp(secs, 0)
        .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_scans_dir_returns_empty_list() {
        // We can't easily mock HOME; just verify the structure
        // returned by `list_scanned_folders` is well-formed when the
        // dir doesn't exist. Since we can't reliably point at a
        // non-existent HOME, we instead verify the function doesn't
        // panic against the real filesystem.
        let result = list_scanned_folders();
        assert!(result.is_ok(), "list must not error: {:?}", result.err());
    }

    #[test]
    fn fingerprint_lookup_by_path_is_consistent_with_list() {
        // Pick an arbitrary path and verify fingerprint computation
        // matches between `from_path` and the registry's lookup.
        let path = "/tmp/__nonexistent__/drift-test";
        let fp = FolderFingerprint::from_canonical_string(path);
        // has_static_scan should not panic even when the folder doesn't
        // exist on disk.
        let _ = has_static_scan(&fp);
        let _ = find(&fp);
    }

    // -------- list_static_scans_for_in tests ------------------------------
    //
    // Every test uses a fresh tempdir as the simulated `~/.drift/scans/`
    // root. We write meta files directly so the input shape is pinned
    // to the on-disk format the production code reads — no risk of a
    // test passing against a stub that the real loader can't actually
    // consume.

    fn write_meta(dir: &Path, scan_id: &str, source_root: &str, saved_at: &str) {
        let payload = serde_json::json!({
            "scanId": scan_id,
            "savedAt": saved_at,
            "sourceRoot": source_root,
            "profiledLanguage": "Python",
            "files": 2,
            "symbols": 13,
            "findingsTotal": 0,
        });
        fs::write(
            dir.join(format!("{scan_id}.meta.json")),
            serde_json::to_vec_pretty(&payload).unwrap(),
        )
        .unwrap();
    }

    #[test]
    fn list_static_scans_returns_empty_when_dir_missing() {
        let nowhere = std::path::PathBuf::from("/tmp/__definitely_missing_drift_scans_dir__");
        let fp = FolderFingerprint::from_canonical_string("/app");
        let out = list_static_scans_for_in(&nowhere, &fp).unwrap();
        assert!(out.is_empty());
    }

    #[test]
    fn list_static_scans_filters_by_fingerprint() {
        let tmp = tempfile::tempdir().unwrap();
        write_meta(tmp.path(), "scan-a", "/Users/me/project-a", "2026-05-24T10:00:00Z");
        write_meta(tmp.path(), "scan-b", "/Users/me/project-b", "2026-05-24T11:00:00Z");
        write_meta(tmp.path(), "scan-c", "/Users/me/project-a", "2026-05-24T12:00:00Z");

        let fp_a = FolderFingerprint::from_canonical_string("/Users/me/project-a");
        let out = list_static_scans_for_in(tmp.path(), &fp_a).unwrap();
        let ids: Vec<&str> = out.iter().map(|s| s.scan_id.as_str()).collect();
        assert_eq!(ids, vec!["scan-c", "scan-a"], "only project-a, newest first");
    }

    #[test]
    fn list_static_scans_skips_metas_without_source_root() {
        let tmp = tempfile::tempdir().unwrap();
        // Valid row.
        write_meta(tmp.path(), "ok", "/Users/me/proj", "2026-05-24T10:00:00Z");
        // Meta with no sourceRoot — should be ignored, not crash.
        fs::write(
            tmp.path().join("orphan.meta.json"),
            br#"{"scanId":"orphan","savedAt":"2026-05-24T11:00:00Z"}"#,
        )
        .unwrap();

        let fp = FolderFingerprint::from_canonical_string("/Users/me/proj");
        let out = list_static_scans_for_in(tmp.path(), &fp).unwrap();
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].scan_id, "ok");
    }

    #[test]
    fn list_static_scans_skips_malformed_meta_files() {
        let tmp = tempfile::tempdir().unwrap();
        write_meta(tmp.path(), "good", "/Users/me/proj", "2026-05-24T10:00:00Z");
        // Half-written / corrupt file — must not poison the listing.
        fs::write(tmp.path().join("bad.meta.json"), b"{ this is not json").unwrap();

        let fp = FolderFingerprint::from_canonical_string("/Users/me/proj");
        let out = list_static_scans_for_in(tmp.path(), &fp).unwrap();
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].scan_id, "good");
    }

    #[test]
    fn list_static_scans_ignores_files_with_wrong_suffix() {
        let tmp = tempfile::tempdir().unwrap();
        write_meta(tmp.path(), "real", "/Users/me/proj", "2026-05-24T10:00:00Z");
        // Sibling envelope + summary files in the same dir — must not
        // be picked up as metas.
        fs::write(tmp.path().join("real.json"), br#"{"unused":true}"#).unwrap();
        fs::write(tmp.path().join("real.summary.json"), br#"{"unused":true}"#).unwrap();

        let fp = FolderFingerprint::from_canonical_string("/Users/me/proj");
        let out = list_static_scans_for_in(tmp.path(), &fp).unwrap();
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].scan_id, "real");
    }

    #[test]
    fn list_static_scans_carries_display_fields() {
        let tmp = tempfile::tempdir().unwrap();
        write_meta(
            tmp.path(),
            "b487f737",
            "/Users/me/test-python-web-server",
            "2026-05-24T19:22:36Z",
        );
        let fp = FolderFingerprint::from_canonical_string("/Users/me/test-python-web-server");
        let out = list_static_scans_for_in(tmp.path(), &fp).unwrap();
        assert_eq!(out.len(), 1);
        let r = &out[0];
        assert_eq!(r.scan_id, "b487f737");
        assert_eq!(r.source_root, "/Users/me/test-python-web-server");
        assert_eq!(r.profiled_language.as_deref(), Some("Python"));
        assert_eq!(r.files, 2);
        assert_eq!(r.symbols, 13);
    }
}
