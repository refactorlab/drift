//! Container-deployment entry-point discovery: Dockerfile + docker-compose.
//!
//! A Dockerfile's `CMD` / `ENTRYPOINT` IS the entry point of the container —
//! it's literally what runs when the container starts. docker-compose's
//! `services[].command` / `services[].entrypoint` plays the same role for
//! multi-service deployments. Both are first-class "roots" of a running
//! system in exactly the way an HTTP handler or `main()` is, so the
//! profiler surfaces them alongside in-graph roots.
//!
//! Output shape — see `EntryDecl`. Each entry records:
//!   - file + line where the declaration sits
//!   - kind (Dockerfile CMD/ENTRYPOINT, compose command/entrypoint)
//!   - the parsed argv (already shell-split in JSON-array form,
//!     whitespace-split in shell form)
//!   - a `match` block linking the entry to a code symbol when we can
//!     reasonably infer one (e.g. `CMD ["python","app.py"]` → the symbol
//!     in `app.py` with no in-graph caller).
//!
//! Match confidence tiers mirror the classifier's three tiers in spirit:
//!   - `exact` — argv references a file we parsed AND we identified one
//!     of that file's root symbols.
//!   - `likely` — argv references a module/file by basename only, or maps
//!     via convention (`python -m foo` → `foo/__init__.py`).
//!   - `unmatched` — opaque (e.g. `java -jar app.jar`, `./bin/server`).

use crate::graph::{CallGraph, SymbolId};
use crate::{FileTags, Symbol, SymbolKind};
use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use serde_yaml::Value as YamlValue;
use std::path::{Path, PathBuf};
use tree_sitter::Parser;

/// What kind of source produced this entry declaration. Closed-set so
/// the viewer can group/filter without string parsing. New variants are
/// additive — older viewers ignore unknown values.
///
/// Two families:
///   - **Container deployment** (`Dockerfile*`, `Compose*`) — declared in
///     a Dockerfile or docker-compose file; the command runs INSIDE the
///     container when it starts. Parsed in [`docker`](self).
///   - **Language manifest** (`PackageJson*`, `Pyproject*`, `CargoBin`,
///     `DenoTask`) — declared in a per-language package config; the
///     command runs ON the host (npm run, python -m, cargo run, etc.).
///     Parsed in [`crate::manifest`].
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum EntryKind {
    DockerfileCmd,
    DockerfileEntrypoint,
    ComposeCommand,
    ComposeEntrypoint,
    /// `"main"` field in package.json — the file `require('pkg')` loads.
    PackageJsonMain,
    /// `"module"` field in package.json — the ESM entry point.
    PackageJsonModule,
    /// `"bin"` field in package.json (string or object). For the object
    /// form, `service` carries the command name.
    PackageJsonBin,
    /// `"scripts.<name>"` entry in package.json. `service` carries the
    /// script name; argv is the shell-split command.
    PackageJsonScript,
    /// `"tasks.<name>"` entry in deno.json / deno.jsonc.
    DenoTask,
    /// `[project.scripts]` or `[tool.poetry.scripts]` entry in
    /// pyproject.toml. Value format: `"pkg.module:func"`. `service`
    /// carries the script (command) name.
    PyprojectScript,
    /// `[[bin]]` table in Cargo.toml. `service` carries the binary
    /// `name`; argv carries the binary `path` when explicit.
    CargoBin,
}

impl EntryKind {
    pub fn label(&self) -> &'static str {
        match self {
            Self::DockerfileCmd => "Dockerfile CMD",
            Self::DockerfileEntrypoint => "Dockerfile ENTRYPOINT",
            Self::ComposeCommand => "compose command",
            Self::ComposeEntrypoint => "compose entrypoint",
            Self::PackageJsonMain => "package.json main",
            Self::PackageJsonModule => "package.json module",
            Self::PackageJsonBin => "package.json bin",
            Self::PackageJsonScript => "package.json script",
            Self::DenoTask => "deno task",
            Self::PyprojectScript => "pyproject script",
            Self::CargoBin => "Cargo [[bin]]",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MatchConfidence {
    Exact,
    Likely,
    Unmatched,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryDecl {
    pub file: String,
    pub line: usize,
    pub kind: EntryKind,
    /// The raw command as written (joined argv). Useful as a single search
    /// string and for display.
    pub raw: String,
    /// Tokenized argv. `["python", "app.py"]` for JSON-array form;
    /// whitespace-split for shell form.
    pub argv: Vec<String>,
    /// For compose entries only — the service name (`services.<name>`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub service: Option<String>,
    /// `WORKDIR` (Dockerfile) or `services.<name>.working_dir` (compose).
    /// Used by the matcher to resolve relative paths in `argv`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workdir: Option<String>,
    /// Resolved match against the in-graph symbol table, when possible.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub matched: Option<EntryMatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryMatch {
    pub confidence: MatchConfidence,
    pub symbol_id: String,
    pub symbol_name: String,
    pub symbol_file: String,
    pub symbol_line: usize,
    /// Human-readable reason — same role as `ExternalCall.evidence`.
    pub evidence: String,
}

/// Walk `root` honoring the same ignore rules as source-file discovery and
/// return every Dockerfile / docker-compose file we should parse. Filenames
/// we recognize (case-sensitive; Docker is conventionally case-sensitive
/// even on macOS):
///   - `Dockerfile`, `Containerfile`, `Dockerfile.<suffix>`, `<prefix>.Dockerfile`
///   - `docker-compose.yml`, `docker-compose.yaml`, `compose.yml`, `compose.yaml`
pub fn discover_docker_files(root: &Path) -> (Vec<PathBuf>, Vec<PathBuf>) {
    let mut wb = WalkBuilder::new(root);
    wb.standard_filters(true)
        .hidden(true)
        .parents(true)
        .require_git(false)
        .add_custom_ignore_filename(".driftignore");

    let mut dockerfiles = Vec::new();
    let mut composes = Vec::new();
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
        if is_dockerfile_name(name) {
            dockerfiles.push(path.to_path_buf());
        } else if is_compose_name(name) {
            composes.push(path.to_path_buf());
        }
    }
    (dockerfiles, composes)
}

fn is_dockerfile_name(name: &str) -> bool {
    name == "Dockerfile"
        || name == "Containerfile"
        || name.starts_with("Dockerfile.")
        || name.ends_with(".Dockerfile")
}

fn is_compose_name(name: &str) -> bool {
    matches!(
        name,
        "docker-compose.yml"
            | "docker-compose.yaml"
            | "compose.yml"
            | "compose.yaml"
    )
}

/// Parse a Dockerfile with tree-sitter and emit one `EntryDecl` per
/// CMD / ENTRYPOINT found. `WORKDIR` is tracked but not emitted as its
/// own entry — it's threaded into subsequent CMD/ENTRYPOINT entries so
/// the matcher can resolve relative paths.
pub fn parse_dockerfile(path: &Path) -> Vec<EntryDecl> {
    let Ok(src) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let mut parser = Parser::new();
    if parser
        .set_language(&tree_sitter_containerfile::LANGUAGE.into())
        .is_err()
    {
        return Vec::new();
    }
    let Some(tree) = parser.parse(&src, None) else {
        return Vec::new();
    };

    let mut out = Vec::new();
    let mut workdir: Option<String> = None;
    let root_node = tree.root_node();
    let bytes = src.as_bytes();
    let mut cursor = root_node.walk();
    for child in root_node.children(&mut cursor) {
        match child.kind() {
            "workdir_instruction" => {
                // WORKDIR <path>. Take everything after the keyword token.
                if let Some(text) = instruction_arg_text(child, bytes) {
                    workdir = Some(text);
                }
            }
            "cmd_instruction" | "entrypoint_instruction" => {
                let kind = if child.kind() == "cmd_instruction" {
                    EntryKind::DockerfileCmd
                } else {
                    EntryKind::DockerfileEntrypoint
                };
                let (raw, argv) = extract_instruction_argv(child, bytes);
                if argv.is_empty() {
                    continue;
                }
                out.push(EntryDecl {
                    file: path.display().to_string(),
                    line: child.start_position().row + 1,
                    kind,
                    raw,
                    argv,
                    service: None,
                    workdir: workdir.clone(),
                    matched: None,
                });
            }
            _ => {}
        }
    }
    out
}

/// Get the raw text after the instruction keyword (e.g. after `WORKDIR`).
fn instruction_arg_text(node: tree_sitter::Node, bytes: &[u8]) -> Option<String> {
    let mut c = node.walk();
    for child in node.children(&mut c) {
        // Skip the leading keyword (kind == name-of-instruction in lowercase
        // for this grammar, but practically we just want the non-keyword text).
        if child.kind().ends_with("_instruction") {
            continue;
        }
        if let Ok(t) = child.utf8_text(bytes) {
            let t = t.trim();
            if !t.is_empty() && !is_keyword_token(t) {
                return Some(strip_quotes(t).to_string());
            }
        }
    }
    None
}

fn is_keyword_token(s: &str) -> bool {
    matches!(
        s,
        "FROM" | "RUN" | "CMD" | "ENTRYPOINT" | "WORKDIR" | "COPY" | "ADD"
        | "ENV" | "EXPOSE" | "USER" | "LABEL" | "ARG" | "VOLUME"
        | "ONBUILD" | "STOPSIGNAL" | "HEALTHCHECK" | "SHELL" | "MAINTAINER"
    )
}

/// Tokenize a CMD/ENTRYPOINT instruction body. Returns `(raw, argv)`:
///   - raw = source text of the instruction body, minus the keyword
///   - argv = parsed argument list. JSON-array form is split by element;
///     shell form is whitespace-split.
fn extract_instruction_argv(node: tree_sitter::Node, bytes: &[u8]) -> (String, Vec<String>) {
    // First, find the body span (everything after the leading keyword
    // child). We capture the body as raw text for display + as a tree
    // walk for the JSON-array case.
    let body_text = node_body_text(node, bytes);
    let raw = body_text.trim().to_string();

    // Look for a `json_string_array` child anywhere under this instruction —
    // that's the JSON-form `["a", "b"]`. (tree-sitter-containerfile names
    // the node `json_string_array`; an older `string_array` is also kept
    // as a fallback for grammars that ship the shorter name.)
    if let Some(arr_node) = find_descendant(node, "json_string_array")
        .or_else(|| find_descendant(node, "string_array"))
    {
        let argv = extract_string_array(arr_node, bytes);
        return (raw, argv);
    }

    // Shell form: just split whitespace. We deliberately don't do POSIX
    // shell parsing — the goal is to find the FIRST file/module token
    // (argv[1] for `python app.py`, argv[0] for `./app`), not to execute
    // the command. Quotes are stripped per-token.
    let argv: Vec<String> = raw
        .split_whitespace()
        .map(|t| strip_quotes(t).to_string())
        .filter(|t| !t.is_empty())
        .collect();
    (raw, argv)
}

fn node_body_text(node: tree_sitter::Node, bytes: &[u8]) -> String {
    // Skip the first child (the keyword) and concatenate the rest.
    let mut c = node.walk();
    let mut pieces = Vec::new();
    let mut seen_keyword = false;
    for child in node.children(&mut c) {
        if !seen_keyword {
            seen_keyword = true;
            // The first child is conventionally the keyword token for this
            // grammar's instruction nodes; skip it.
            if let Ok(t) = child.utf8_text(bytes) {
                if is_keyword_token(t.trim()) {
                    continue;
                }
            }
        }
        if let Ok(t) = child.utf8_text(bytes) {
            pieces.push(t.to_string());
        }
    }
    pieces.join(" ")
}

fn find_descendant<'a>(node: tree_sitter::Node<'a>, kind: &str) -> Option<tree_sitter::Node<'a>> {
    let mut stack = vec![node];
    while let Some(n) = stack.pop() {
        if n.kind() == kind {
            return Some(n);
        }
        let mut c = n.walk();
        for child in n.children(&mut c) {
            stack.push(child);
        }
    }
    None
}

fn extract_string_array(node: tree_sitter::Node, bytes: &[u8]) -> Vec<String> {
    let mut out = Vec::new();
    let mut c = node.walk();
    for child in node.children(&mut c) {
        if child.kind() == "json_string" || child.kind() == "double_quoted_string" {
            if let Ok(t) = child.utf8_text(bytes) {
                out.push(strip_quotes(t).to_string());
            }
        }
    }
    out
}

fn strip_quotes(s: &str) -> &str {
    let t = s.trim();
    if (t.starts_with('"') && t.ends_with('"') && t.len() >= 2)
        || (t.starts_with('\'') && t.ends_with('\'') && t.len() >= 2)
    {
        &t[1..t.len() - 1]
    } else {
        t
    }
}

/// Parse docker-compose.yml. Emit one entry per `services.<name>.command`
/// and one per `services.<name>.entrypoint`. Service-level `working_dir`
/// is threaded onto entries the same way Dockerfile WORKDIR is.
pub fn parse_compose(path: &Path) -> Vec<EntryDecl> {
    let Ok(src) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let Ok(doc) = serde_yaml::from_str::<YamlValue>(&src) else {
        return Vec::new();
    };
    let Some(services) = doc.get("services").and_then(|v| v.as_mapping()) else {
        return Vec::new();
    };

    let mut out = Vec::new();
    for (sk, sv) in services.iter() {
        let Some(name) = sk.as_str() else { continue };
        let Some(svc) = sv.as_mapping() else { continue };
        let workdir = svc
            .get("working_dir")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        if let Some(v) = svc.get("command") {
            if let Some((raw, argv)) = yaml_argv(v) {
                out.push(EntryDecl {
                    file: path.display().to_string(),
                    line: 1, // serde_yaml drops line spans; keep best-effort
                    kind: EntryKind::ComposeCommand,
                    raw,
                    argv,
                    service: Some(name.to_string()),
                    workdir: workdir.clone(),
                    matched: None,
                });
            }
        }
        if let Some(v) = svc.get("entrypoint") {
            if let Some((raw, argv)) = yaml_argv(v) {
                out.push(EntryDecl {
                    file: path.display().to_string(),
                    line: 1,
                    kind: EntryKind::ComposeEntrypoint,
                    raw,
                    argv,
                    service: Some(name.to_string()),
                    workdir,
                    matched: None,
                });
            }
        }
    }
    out
}

/// Convert a YAML `command` / `entrypoint` field into `(raw, argv)`.
/// Compose accepts BOTH `command: "npm start"` (string) and
/// `command: ["npm","start"]` (sequence). We support both.
fn yaml_argv(v: &YamlValue) -> Option<(String, Vec<String>)> {
    if let Some(s) = v.as_str() {
        let raw = s.to_string();
        let argv: Vec<String> = s.split_whitespace().map(|t| t.to_string()).collect();
        return Some((raw, argv));
    }
    if let Some(seq) = v.as_sequence() {
        let argv: Vec<String> = seq
            .iter()
            .filter_map(|x| x.as_str().map(|s| s.to_string()))
            .collect();
        if argv.is_empty() {
            return None;
        }
        let raw = argv.join(" ");
        return Some((raw, argv));
    }
    None
}

/// Best-effort link every entry to an in-graph symbol. The output is the
/// same `entries` list, with `matched` populated when we found a target.
///
/// Strategy — start narrow, widen on miss:
///   1. argv has a literal file we parsed → pick that file's most likely
///      entry symbol (root with no in-graph caller; fall back to a name
///      like `main`/`bootstrap`/`app`).
///   2. `python -m mod` / `node -e ...` style → resolve `mod` to a file
///      basename match in our parsed set.
///   3. Otherwise → no match.
pub fn match_entries(entries: &mut [EntryDecl], all_tags: &[FileTags], graph: &CallGraph) {
    for e in entries.iter_mut() {
        if let Some(m) = match_one(e, all_tags, graph) {
            e.matched = Some(m);
        }
    }
}

fn match_one(
    entry: &EntryDecl,
    all_tags: &[FileTags],
    graph: &CallGraph,
) -> Option<EntryMatch> {
    if entry.argv.is_empty() {
        return None;
    }

    // Pass 1: argv contains a literal file we parsed (exact basename or
    // suffix match). `python app.py` → argv[1] = "app.py".
    for tok in &entry.argv {
        if let Some(sym) = pick_entry_symbol_for_filename(tok, all_tags, graph) {
            return Some(EntryMatch {
                confidence: MatchConfidence::Exact,
                symbol_id: SymbolId::for_symbol(sym).0,
                symbol_name: sym.name.clone(),
                symbol_file: sym.file.display().to_string(),
                symbol_line: sym.line,
                evidence: format!("argv token `{tok}` matches parsed file"),
            });
        }
    }

    // Pass 2: `python -m mymodule` / `python3 -m mymodule.cli` — convert
    // dotted module path to file path candidates.
    if let Some(module) = python_dash_m(&entry.argv) {
        if let Some(m) = resolve_python_module(&module, None, all_tags, graph) {
            return Some(m);
        }
    }

    // Pass 3: pyproject-style `"pkg.mod:func"` — a single argv token that
    // contains a `:` is a Python entry-point target. The function name
    // after `:` is the symbol we want; the module before is the file.
    if entry.argv.len() == 1 {
        if let Some((module, func)) = entry.argv[0].split_once(':') {
            if let Some(m) = resolve_python_module(module, Some(func), all_tags, graph) {
                return Some(m);
            }
        }
    }

    None
}

/// Resolve a Python dotted-module path (`pkg.mod`) into one of our parsed
/// files. If `prefer_func` is given, we look for that function name first;
/// otherwise we fall back to the file's most likely entry symbol.
fn resolve_python_module(
    module: &str,
    prefer_func: Option<&str>,
    all_tags: &[FileTags],
    graph: &CallGraph,
) -> Option<EntryMatch> {
    let parts: Vec<&str> = module.split('.').collect();
    let candidates = [
        format!("{}.py", parts.join("/")),
        format!("{}/__main__.py", parts.join("/")),
        format!("{}/__init__.py", parts.join("/")),
        format!("{}.py", parts.last().copied().unwrap_or("")),
    ];
    for cand in &candidates {
        let file_match = all_tags.iter().find(|ft| {
            let p = ft.file.to_string_lossy();
            p.ends_with(cand.as_str())
        });
        let Some(file_tags) = file_match else { continue };

        // Prefer the named function from the entry-point target, when given.
        if let Some(want) = prefer_func {
            if let Some(sym) = file_tags.symbols.iter().find(|s| s.name == want) {
                return Some(EntryMatch {
                    confidence: MatchConfidence::Exact,
                    symbol_id: SymbolId::for_symbol(sym).0,
                    symbol_name: sym.name.clone(),
                    symbol_file: sym.file.display().to_string(),
                    symbol_line: sym.line,
                    evidence: format!("`{module}:{want}` → {cand}:{want}"),
                });
            }
        }

        // Else: file's plausible entry symbol.
        if let Some(sym) = pick_entry_symbol_in_file(file_tags, graph) {
            return Some(EntryMatch {
                confidence: MatchConfidence::Likely,
                symbol_id: SymbolId::for_symbol(sym).0,
                symbol_name: sym.name.clone(),
                symbol_file: sym.file.display().to_string(),
                symbol_line: sym.line,
                evidence: format!("`python -m {module}` → {cand}"),
            });
        }
    }
    None
}

/// Pull `MOD` out of `python -m MOD ...` / `python3 -m MOD`. Returns None
/// if argv[0] isn't a python interpreter or `-m` isn't present.
fn python_dash_m(argv: &[String]) -> Option<String> {
    let zero = argv.first()?;
    if !zero.ends_with("python") && !zero.ends_with("python3") {
        return None;
    }
    let mut i = 1;
    while i < argv.len() {
        if argv[i] == "-m" && i + 1 < argv.len() {
            return Some(argv[i + 1].clone());
        }
        i += 1;
    }
    None
}

/// Given an argv token like `app.py` or `pkg/server.js`, find a file in
/// `all_tags` whose path ends with that token (case-sensitive), and pick
/// its most likely entry symbol.
fn pick_entry_symbol_for_filename<'a>(
    token: &str,
    all_tags: &'a [FileTags],
    graph: &CallGraph,
) -> Option<&'a Symbol> {
    // The token must look file-shaped: contain a dot OR a slash. Avoids
    // matching arbitrary words like `pip`, `serve`, `prod`.
    if !token.contains('.') && !token.contains('/') {
        return None;
    }
    let token_norm = token.trim_start_matches("./").to_string();

    let matches: Vec<&FileTags> = all_tags
        .iter()
        .filter(|ft| {
            let p = ft.file.to_string_lossy();
            p.ends_with(&token_norm) || p.ends_with(token)
        })
        .collect();
    let file_tags = match matches.as_slice() {
        [] => return None,
        [single] => *single,
        _ => {
            // Multiple files share the suffix. Prefer the one with the
            // most symbols (likely the real entry, not a stub).
            *matches
                .iter()
                .max_by_key(|ft| ft.symbols.len())
                .expect("non-empty")
        }
    };
    pick_entry_symbol_in_file(file_tags, graph)
}

/// Within a single file, pick the symbol that's most plausibly the
/// container's start function: prefer a name match (`main`, `bootstrap`,
/// `app`, `start`, `run`), then the symbol with no in-graph caller and
/// the largest subtree.
fn pick_entry_symbol_in_file<'a>(
    file_tags: &'a FileTags,
    graph: &CallGraph,
) -> Option<&'a Symbol> {
    const PREFERRED: &[&str] = &[
        "main", "bootstrap", "app", "start", "run", "serve", "listen", "create_app",
    ];
    for want in PREFERRED {
        if let Some(s) = file_tags
            .symbols
            .iter()
            .find(|s| !matches!(s.kind, SymbolKind::Class) && s.name.eq_ignore_ascii_case(want))
        {
            return Some(s);
        }
    }
    // Fall back: function with no in-graph caller (in this file).
    file_tags
        .symbols
        .iter()
        .filter(|s| !matches!(s.kind, SymbolKind::Class))
        .find(|s| {
            let id = SymbolId::for_symbol(s);
            graph.callers.get(&id).map(|v| v.is_empty()).unwrap_or(true)
        })
}

/// Top-level entry point: discover, parse, and match in one call.
/// Used by `api::build_graph_context` so the rest of the pipeline gets
/// a fully-resolved `Vec<EntryDecl>`.
pub fn collect(root: &Path, all_tags: &[FileTags], graph: &CallGraph) -> Vec<EntryDecl> {
    let (dockerfiles, composes) = discover_docker_files(root);
    let mut out = Vec::new();
    for p in dockerfiles {
        out.extend(parse_dockerfile(&p));
    }
    for p in composes {
        out.extend(parse_compose(&p));
    }
    match_entries(&mut out, all_tags, graph);
    out
}

/// For every matched `EntryDecl`, find the corresponding `CallTreeNode`
/// in `entries` (by `SymbolId`) and append a human-readable label like
/// `"Dockerfile CMD"` or `"compose:api"`. No-op when the matcher couldn't
/// resolve the entry. Idempotent — won't re-add the same label twice.
pub fn label_call_tree_entries(
    entry_declarations: &[EntryDecl],
    call_trees: &mut [crate::tree::CallTreeNode],
) {
    for de in entry_declarations {
        let Some(m) = &de.matched else { continue };
        let label = match (&de.kind, &de.service) {
            (EntryKind::ComposeCommand, Some(s)) => format!("compose:{s} command"),
            (EntryKind::ComposeEntrypoint, Some(s)) => format!("compose:{s} entrypoint"),
            // Manifest entries with a known service name read more
            // usefully as `package.json:scripts.start` than as the bare
            // kind label. Mirrors `compose:<svc>` formatting.
            (EntryKind::PackageJsonScript, Some(s)) => format!("package.json:scripts.{s}"),
            (EntryKind::PackageJsonBin, Some(s)) => format!("package.json:bin.{s}"),
            (EntryKind::DenoTask, Some(s)) => format!("deno:tasks.{s}"),
            (EntryKind::PyprojectScript, Some(s)) => format!("pyproject:scripts.{s}"),
            (EntryKind::CargoBin, Some(s)) => format!("Cargo:[[bin]] {s}"),
            (k, _) => k.label().to_string(),
        };
        for node in call_trees.iter_mut() {
            if node.id.0 == m.symbol_id && !node.entry_labels.contains(&label) {
                node.entry_labels.push(label.clone());
            }
        }
    }
}
