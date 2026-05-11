//! Read-only directory listing — the agent's "ls" / "tree".
//!
//! The agent uses this when it needs to understand a project's layout before
//! deciding which test runner / framework / profiler is appropriate. It's
//! deliberately small: bounded depth, no recursion into noisy directories,
//! capped entry count, and returns a flat list rather than a tree string so
//! the model can reason about path components programmatically.
//!
//! Default ignores skip the things every JS/Python/Rust project has that the
//! model never benefits from sampling: `node_modules`, `.git`, `target`,
//! `dist`, `build`, `__pycache__`, `.venv`. Callers can override with
//! `extra_ignore` (additive) — we never *remove* the safe defaults.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use super::ToolManifest;

pub const NAME: &str = "list_directory";
pub const DESCRIPTION: &str =
    "List files and subdirectories under a path, up to `max_depth` levels deep, with a hard cap on \
     entry count. Skips noisy directories (node_modules, .git, target, dist, build, __pycache__, \
     .venv) by default. Use this to investigate a project's layout before picking tools.";
pub const PARAMETERS: &str = r#"{
  "type": "object",
  "properties": {
    "path": {"type": "string", "description": "Absolute path to scan."},
    "max_depth": {"type": "integer", "description": "Recursion depth (default 3, max 6)."},
    "max_entries": {"type": "integer", "description": "Cap on total entries returned (default 200, max 1000)."},
    "extra_ignore": {
      "type": "array",
      "items": {"type": "string"},
      "description": "Additional directory or file names to skip (added to safe defaults)."
    }
  },
  "required": ["path"]
}"#;

#[derive(Debug, Deserialize)]
pub struct Args {
    pub path: String,
    pub max_depth: Option<u32>,
    pub max_entries: Option<u32>,
    #[serde(default)]
    pub extra_ignore: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EntryKind {
    File,
    Dir,
    /// Symlink — we don't follow them, just record where they pointed.
    Symlink,
}

#[derive(Debug, Serialize)]
pub struct Entry {
    /// Path relative to the requested root. The agent re-roots with `path` if
    /// it wants the absolute form; this keeps payloads small.
    pub rel_path: String,
    pub kind: EntryKind,
    pub depth: u32,
    /// Size in bytes for files, `None` for directories. Cap at u64::MAX which
    /// is fine — the model gets a hint for big files without us streaming them.
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct Output {
    pub root: String,
    pub entries: Vec<Entry>,
    /// True if we hit `max_entries` before the walk finished. The model can
    /// re-call with a deeper/narrower scope.
    pub truncated: bool,
    /// Total number of entries we *would* have returned absent the cap.
    /// Useful for the agent to gauge whether to drill in.
    pub total_seen: u64,
}

pub fn manifest() -> ToolManifest {
    ToolManifest {
        name: NAME,
        description: DESCRIPTION,
        parameters: PARAMETERS,
    }
}

const DEFAULT_DEPTH: u32 = 3;
const MAX_DEPTH_HARD: u32 = 6;
const DEFAULT_ENTRIES: u32 = 200;
const MAX_ENTRIES_HARD: u32 = 1000;

/// Always-skipped directory names. Even if the LLM asks for `node_modules`
/// explicitly we won't honour it — the cost/reward is terrible (millions of
/// files for ~zero signal). If the user really wants to look in there they
/// can use a focused `read_file_excerpt` call.
fn default_ignore() -> BTreeSet<&'static str> {
    [
        "node_modules",
        ".git",
        "target",
        "dist",
        "build",
        ".next",
        ".turbo",
        "__pycache__",
        ".venv",
        "venv",
        ".tox",
        ".cache",
        ".pytest_cache",
        ".mypy_cache",
        ".gradle",
        ".idea",
        ".vscode",
    ]
    .into_iter()
    .collect()
}

pub async fn run(args: Args) -> Result<Output> {
    let root = PathBuf::from(&args.path);
    if !root.is_dir() {
        anyhow::bail!("not a directory: {}", root.display());
    }

    let max_depth = args.max_depth.unwrap_or(DEFAULT_DEPTH).min(MAX_DEPTH_HARD);
    let cap = args
        .max_entries
        .unwrap_or(DEFAULT_ENTRIES)
        .min(MAX_ENTRIES_HARD) as usize;
    let mut ignore = default_ignore();
    let extras: Vec<String> = args.extra_ignore;
    for s in &extras {
        ignore.insert(s.as_str());
    }

    let mut out = Vec::with_capacity(cap.min(64));
    let mut total_seen: u64 = 0;
    let truncated = walk(&root, &root, 0, max_depth, &ignore, cap, &mut out, &mut total_seen)
        .with_context(|| format!("walking {}", root.display()))?;

    Ok(Output {
        root: root.display().to_string(),
        entries: out,
        truncated,
        total_seen,
    })
}

/// Returns `true` if the cap was hit (truncated). Otherwise the walk
/// completed and `total_seen == out.len()`.
#[allow(clippy::too_many_arguments)]
fn walk(
    root: &Path,
    dir: &Path,
    depth: u32,
    max_depth: u32,
    ignore: &BTreeSet<&str>,
    cap: usize,
    out: &mut Vec<Entry>,
    total_seen: &mut u64,
) -> Result<bool> {
    let read = match std::fs::read_dir(dir) {
        Ok(r) => r,
        // Permission errors are common on system dirs — skip silently rather
        // than error out the whole listing.
        Err(_) => return Ok(false),
    };

    // Sort children so output is stable across runs — important for tests
    // and for cache friendliness in transcripts.
    let mut children: Vec<_> = read.filter_map(|e| e.ok()).collect();
    children.sort_by_key(|e| e.file_name());

    for entry in children {
        let name = match entry.file_name().to_str() {
            Some(s) => s.to_string(),
            None => continue, // non-utf8 names — ignore rather than fail
        };
        if ignore.contains(name.as_str()) {
            continue;
        }
        let path = entry.path();
        let rel = path.strip_prefix(root).unwrap_or(&path).display().to_string();
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let (kind, size) = if metadata.file_type().is_symlink() {
            (EntryKind::Symlink, None)
        } else if metadata.is_dir() {
            (EntryKind::Dir, None)
        } else {
            (EntryKind::File, Some(metadata.len()))
        };

        *total_seen += 1;
        if out.len() >= cap {
            // Keep counting so total_seen is honest, but stop pushing.
            continue;
        }
        out.push(Entry {
            rel_path: rel,
            kind,
            depth,
            size_bytes: size,
        });

        if matches!(kind, EntryKind::Dir) && depth + 1 < max_depth {
            walk(root, &path, depth + 1, max_depth, ignore, cap, out, total_seen)?;
        }
    }
    Ok(out.len() >= cap)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tempdir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir()
            .join(format!("drift-listdir-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[tokio::test]
    async fn lists_files_at_depth_one() {
        let dir = tempdir("flat");
        std::fs::write(dir.join("a.txt"), "x").unwrap();
        std::fs::write(dir.join("b.txt"), "yy").unwrap();
        std::fs::create_dir_all(dir.join("sub")).unwrap();
        std::fs::write(dir.join("sub/c.txt"), "zzz").unwrap();

        let out = run(Args {
            path: dir.display().to_string(),
            max_depth: Some(1),
            max_entries: None,
            extra_ignore: vec![],
        })
        .await
        .unwrap();

        let names: Vec<_> = out.entries.iter().map(|e| e.rel_path.clone()).collect();
        // depth=1 means we list the root's immediate children but don't
        // descend into `sub/`.
        assert!(names.contains(&"a.txt".to_string()));
        assert!(names.contains(&"b.txt".to_string()));
        assert!(names.contains(&"sub".to_string()));
        assert!(!names.iter().any(|n| n.contains("c.txt")));
    }

    #[tokio::test]
    async fn skips_default_ignored_dirs() {
        let dir = tempdir("ignore");
        std::fs::create_dir_all(dir.join("node_modules/foo")).unwrap();
        std::fs::write(dir.join("node_modules/foo/index.js"), "x").unwrap();
        std::fs::create_dir_all(dir.join(".git")).unwrap();
        std::fs::write(dir.join("package.json"), "{}").unwrap();

        let out = run(Args {
            path: dir.display().to_string(),
            max_depth: Some(3),
            max_entries: None,
            extra_ignore: vec![],
        })
        .await
        .unwrap();

        let names: Vec<_> = out.entries.iter().map(|e| e.rel_path.clone()).collect();
        assert!(names.contains(&"package.json".to_string()));
        assert!(!names.iter().any(|n| n.starts_with("node_modules")));
        assert!(!names.iter().any(|n| n.starts_with(".git")));
    }

    #[tokio::test]
    async fn caps_entries_and_marks_truncated() {
        let dir = tempdir("cap");
        for i in 0..20 {
            std::fs::write(dir.join(format!("f{i}.txt")), "x").unwrap();
        }

        let out = run(Args {
            path: dir.display().to_string(),
            max_depth: Some(1),
            max_entries: Some(5),
            extra_ignore: vec![],
        })
        .await
        .unwrap();

        assert_eq!(out.entries.len(), 5);
        assert!(out.truncated);
        assert!(out.total_seen >= 20);
    }

    #[tokio::test]
    async fn errors_when_path_is_not_a_directory() {
        let err = run(Args {
            path: "/definitely/not/here/zzz".into(),
            max_depth: None,
            max_entries: None,
            extra_ignore: vec![],
        })
        .await
        .unwrap_err();
        assert!(err.to_string().contains("not a directory"));
    }

    #[tokio::test]
    async fn extra_ignore_is_additive() {
        let dir = tempdir("extra");
        std::fs::write(dir.join("keep.txt"), "x").unwrap();
        std::fs::create_dir_all(dir.join("docs")).unwrap();
        std::fs::write(dir.join("docs/page.md"), "x").unwrap();

        let out = run(Args {
            path: dir.display().to_string(),
            max_depth: Some(3),
            max_entries: None,
            extra_ignore: vec!["docs".into()],
        })
        .await
        .unwrap();

        let names: Vec<_> = out.entries.iter().map(|e| e.rel_path.clone()).collect();
        assert!(names.contains(&"keep.txt".to_string()));
        assert!(!names.iter().any(|n| n.starts_with("docs")));
    }

    #[tokio::test]
    async fn reports_file_size_for_files() {
        let dir = tempdir("size");
        std::fs::write(dir.join("a.txt"), "hello").unwrap();
        let out = run(Args {
            path: dir.display().to_string(),
            max_depth: Some(1),
            max_entries: None,
            extra_ignore: vec![],
        })
        .await
        .unwrap();
        let entry = out.entries.iter().find(|e| e.rel_path == "a.txt").unwrap();
        assert_eq!(entry.size_bytes, Some(5));
        assert_eq!(entry.kind, EntryKind::File);
    }
}
