//! Language-manifest entry-point discovery.
//!
//! Sibling of [`crate::docker`] — same output shape ([`EntryDecl`]), but
//! the entries come from per-language package manifests:
//!
//! | Language          | File                | Fields parsed                            |
//! |-------------------|---------------------|------------------------------------------|
//! | Node / JS / TS    | `package.json`      | `main`, `module`, `bin`, `scripts`       |
//! | Deno              | `deno.json[c]`      | `tasks`                                  |
//! | Python            | `pyproject.toml`    | `[project.scripts]`, `[tool.poetry.scripts]` |
//! | Rust              | `Cargo.toml`        | `[[bin]]`                                |
//!
//! Each declared entry point is recorded with the same `EntryDecl` shape
//! `docker.rs` already uses, so downstream code (matcher, labeler, JSON
//! schema, viewer) doesn't care which family it came from. The matcher
//! is the existing one in `docker::match_entries` — it already handles
//! "argv contains a parsed file" and `python -m pkg.mod`, and was
//! extended in this pass to handle the pyproject `pkg.mod:func` shape.
//!
//! Why one type, two files: containers and language manifests are the
//! SAME concept ("how does the program start?") seen from different
//! deployment angles. Keeping them as separate Rust modules makes the
//! parsing easy to evolve per family without a god-file.

use crate::docker::{EntryDecl, EntryKind};
use ignore::WalkBuilder;
use serde_json::Value as JsonValue;
use std::path::{Path, PathBuf};
use toml::Value as TomlValue;

/// Manifest filenames we know how to read. Discovery returns one bucket
/// per known kind so each parser only sees files it expects.
#[derive(Debug, Default)]
pub struct DiscoveredManifests {
    pub package_json: Vec<PathBuf>,
    pub deno_json: Vec<PathBuf>,
    pub pyproject_toml: Vec<PathBuf>,
    pub cargo_toml: Vec<PathBuf>,
}

/// Walk `root` honoring the same ignore rules as source-file discovery
/// (mirrors `docker::discover_docker_files`). Returns one [`DiscoveredManifests`]
/// covering the whole tree.
pub fn discover_manifests(root: &Path) -> DiscoveredManifests {
    let mut wb = WalkBuilder::new(root);
    wb.standard_filters(true)
        .hidden(true)
        .parents(true)
        .require_git(false)
        .add_custom_ignore_filename(".driftignore");

    let mut out = DiscoveredManifests::default();
    for entry in wb.build().flatten() {
        if !entry.file_type().is_some_and(|t| t.is_file()) {
            continue;
        }
        let path = entry.path();
        if crate::walker::DEFAULT_IGNORE_DIRS
            .iter()
            .any(|d| path.components().any(|c| c.as_os_str() == *d))
        {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        match name {
            "package.json" => out.package_json.push(path.to_path_buf()),
            "deno.json" | "deno.jsonc" => out.deno_json.push(path.to_path_buf()),
            "pyproject.toml" => out.pyproject_toml.push(path.to_path_buf()),
            "Cargo.toml" => out.cargo_toml.push(path.to_path_buf()),
            _ => {}
        }
    }
    out
}

// ── package.json ────────────────────────────────────────────────────────

/// Parse a `package.json` and emit entries for `main`, `module`, `bin`,
/// and every key under `scripts`. Lines are best-effort 1 since
/// `serde_json` drops line spans; tooling can grep the file by `service`.
pub fn parse_package_json(path: &Path) -> Vec<EntryDecl> {
    let Ok(src) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let Ok(doc) = serde_json::from_str::<JsonValue>(&src) else {
        return Vec::new();
    };
    let file = path.display().to_string();
    let mut out = Vec::new();

    if let Some(s) = doc.get("main").and_then(|v| v.as_str()) {
        out.push(simple_entry(&file, EntryKind::PackageJsonMain, None, s));
    }
    if let Some(s) = doc.get("module").and_then(|v| v.as_str()) {
        out.push(simple_entry(&file, EntryKind::PackageJsonModule, None, s));
    }
    match doc.get("bin") {
        Some(JsonValue::String(s)) => {
            // package.json shorthand: `"bin": "./cli.js"` is the same as
            // `"bin": { "<package_name>": "./cli.js" }`. We don't bother
            // resolving the package name — `service` stays None and the
            // raw command shows the path.
            out.push(simple_entry(&file, EntryKind::PackageJsonBin, None, s));
        }
        Some(JsonValue::Object(map)) => {
            for (cmd, v) in map {
                if let Some(s) = v.as_str() {
                    out.push(simple_entry(
                        &file,
                        EntryKind::PackageJsonBin,
                        Some(cmd.clone()),
                        s,
                    ));
                }
            }
        }
        _ => {}
    }
    if let Some(map) = doc.get("scripts").and_then(|v| v.as_object()) {
        for (name, v) in map {
            let Some(cmd) = v.as_str() else { continue };
            out.push(shell_entry(
                &file,
                EntryKind::PackageJsonScript,
                Some(name.clone()),
                cmd,
            ));
        }
    }
    out
}

// ── deno.json[c] ────────────────────────────────────────────────────────

/// Parse a `deno.json` / `deno.jsonc` and emit one entry per `tasks.*`.
/// `serde_json` won't accept comments — we strip `// ...` and `/* ... */`
/// before parsing so `.jsonc` works too.
pub fn parse_deno_json(path: &Path) -> Vec<EntryDecl> {
    let Ok(raw) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let src = strip_jsonc_comments(&raw);
    let Ok(doc) = serde_json::from_str::<JsonValue>(&src) else {
        return Vec::new();
    };
    let file = path.display().to_string();
    let mut out = Vec::new();
    let Some(map) = doc.get("tasks").and_then(|v| v.as_object()) else {
        return out;
    };
    for (name, v) in map {
        let Some(cmd) = v.as_str() else { continue };
        out.push(shell_entry(
            &file,
            EntryKind::DenoTask,
            Some(name.clone()),
            cmd,
        ));
    }
    out
}

/// Best-effort `.jsonc` comment stripper. Handles `// ...` to end-of-line
/// and `/* ... */`. Doesn't track strings — but since deno's task values
/// don't legitimately contain `//`-or-`/*` sequences in practice, this is
/// pragmatic and robust enough.
fn strip_jsonc_comments(src: &str) -> String {
    let mut out = String::with_capacity(src.len());
    let bytes = src.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        // Line comment.
        if i + 1 < bytes.len() && bytes[i] == b'/' && bytes[i + 1] == b'/' {
            while i < bytes.len() && bytes[i] != b'\n' {
                i += 1;
            }
            continue;
        }
        // Block comment.
        if i + 1 < bytes.len() && bytes[i] == b'/' && bytes[i + 1] == b'*' {
            i += 2;
            while i + 1 < bytes.len() && !(bytes[i] == b'*' && bytes[i + 1] == b'/') {
                i += 1;
            }
            i = (i + 2).min(bytes.len());
            continue;
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    out
}

// ── pyproject.toml ──────────────────────────────────────────────────────

/// Parse a `pyproject.toml`. Recognized tables:
///   - `[project.scripts]` (PEP 621)
///   - `[tool.poetry.scripts]` (Poetry)
///
/// Each entry value is the canonical Python entry-point target string:
/// `"package.module:function"`. We pass it through as the sole argv token
/// so the matcher's `pkg.mod:func` branch can resolve it.
pub fn parse_pyproject_toml(path: &Path) -> Vec<EntryDecl> {
    let Ok(src) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let Ok(doc) = src.parse::<TomlValue>() else {
        return Vec::new();
    };
    let file = path.display().to_string();
    let mut out = Vec::new();

    for tbl_path in &[
        ["project", "scripts"].as_slice(),
        ["tool", "poetry", "scripts"].as_slice(),
    ] {
        if let Some(TomlValue::Table(scripts)) = toml_lookup(&doc, tbl_path) {
            for (name, v) in scripts {
                let Some(target) = v.as_str() else { continue };
                out.push(EntryDecl {
                    file: file.clone(),
                    line: 1,
                    kind: EntryKind::PyprojectScript,
                    raw: target.to_string(),
                    argv: vec![target.to_string()],
                    service: Some(name.clone()),
                    workdir: None,
                    matched: None,
                });
            }
        }
    }
    out
}

fn toml_lookup<'a>(doc: &'a TomlValue, path: &[&str]) -> Option<&'a TomlValue> {
    let mut cur = doc;
    for seg in path {
        cur = cur.get(seg)?;
    }
    Some(cur)
}

// ── Cargo.toml ──────────────────────────────────────────────────────────

/// Parse a `Cargo.toml`. Emits one entry per `[[bin]]` table. The
/// implicit `src/main.rs` binary is NOT emitted here — auto-root discovery
/// already picks up its `main` symbol.
pub fn parse_cargo_toml(path: &Path) -> Vec<EntryDecl> {
    let Ok(src) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let Ok(doc) = src.parse::<TomlValue>() else {
        return Vec::new();
    };
    let file = path.display().to_string();
    let mut out = Vec::new();

    let Some(bins) = doc.get("bin").and_then(|v| v.as_array()) else {
        return out;
    };
    for bin in bins {
        let Some(tbl) = bin.as_table() else { continue };
        let name = tbl.get("name").and_then(|v| v.as_str()).map(String::from);
        let bin_path = tbl.get("path").and_then(|v| v.as_str()).unwrap_or("");
        // argv is the path (when given) — that's what the matcher uses.
        // raw is `<name> [<path>]` so it reads as the user wrote it.
        let raw = match (&name, bin_path) {
            (Some(n), "") => n.clone(),
            (Some(n), p) => format!("{n} ({p})"),
            (None, p) => p.to_string(),
        };
        let argv = if bin_path.is_empty() {
            // No explicit path — Cargo convention is `src/bin/<name>.rs`.
            // Surface that as the argv so the matcher can find it.
            match &name {
                Some(n) => vec![format!("src/bin/{n}.rs")],
                None => Vec::new(),
            }
        } else {
            vec![bin_path.to_string()]
        };
        if argv.is_empty() {
            continue;
        }
        out.push(EntryDecl {
            file: file.clone(),
            line: 1,
            kind: EntryKind::CargoBin,
            raw,
            argv,
            service: name,
            workdir: None,
            matched: None,
        });
    }
    out
}

// ── shared helpers ──────────────────────────────────────────────────────

/// Single-token entry: the value is a file path (e.g. package.json
/// `"main": "./src/index.js"`).
fn simple_entry(file: &str, kind: EntryKind, service: Option<String>, value: &str) -> EntryDecl {
    EntryDecl {
        file: file.to_string(),
        line: 1,
        kind,
        raw: value.to_string(),
        argv: vec![value.to_string()],
        service,
        workdir: None,
        matched: None,
    }
}

/// Shell-form entry: value is a shell command like `node server.js`.
/// We whitespace-split for argv — same lax tokenization the Dockerfile
/// shell-form parser uses, for the same reason: we don't want to execute
/// the shell, just identify file-shaped tokens.
fn shell_entry(file: &str, kind: EntryKind, service: Option<String>, cmd: &str) -> EntryDecl {
    let argv: Vec<String> = cmd.split_whitespace().map(String::from).collect();
    EntryDecl {
        file: file.to_string(),
        line: 1,
        kind,
        raw: cmd.to_string(),
        argv,
        service,
        workdir: None,
        matched: None,
    }
}

/// Top-level entry point: discover every manifest, parse each, and return
/// the merged list. The caller then runs `docker::match_entries` to fill
/// in symbol back-links.
pub fn collect(root: &Path) -> Vec<EntryDecl> {
    let m = discover_manifests(root);
    let mut out = Vec::new();
    for p in &m.package_json {
        out.extend(parse_package_json(p));
    }
    for p in &m.deno_json {
        out.extend(parse_deno_json(p));
    }
    for p in &m.pyproject_toml {
        out.extend(parse_pyproject_toml(p));
    }
    for p in &m.cargo_toml {
        out.extend(parse_cargo_toml(p));
    }
    out
}
