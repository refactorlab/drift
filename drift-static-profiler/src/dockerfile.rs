//! Dockerfile-based entry-point discovery.
//!
//! Walks a project root for `Dockerfile` and `Dockerfile.*` files, parses
//! their `ENTRYPOINT` and `CMD` instructions, and extracts candidate symbol
//! names that can be passed straight to [`crate::analyze`] as entry points.
//!
//! # Supported runtimes
//! | Command                          | Extracted symbol |
//! |----------------------------------|-----------------|
//! | `python app.py`                  | stem of file    |
//! | `python -m uvicorn main:app`     | `app`           |
//! | `uvicorn main:create_app`        | `create_app`    |
//! | `gunicorn -w 4 wsgi:application` | `application`   |
//! | `node src/index.js`              | `index`         |
//! | `bun run src/server.ts`          | `server`        |
//! | `deno run main.ts`               | `main`          |
//! | `java com.example.Main`          | `Main`          |

use std::path::{Path, PathBuf};

/// A single entry point inferred from a Dockerfile.
#[derive(Debug, Clone)]
pub struct DockerEntrypoint {
    /// The Dockerfile this was found in.
    pub dockerfile: PathBuf,
    /// The combined `ENTRYPOINT` + `CMD` tokens as parsed from the file.
    pub raw_cmd: Vec<String>,
    /// Candidate symbol names to search for in the call graph.
    pub symbols: Vec<String>,
    /// The source file the command appears to target, if determinable
    /// (e.g. `main.py` for `CMD ["python", "main.py"]`).
    pub source_file: Option<PathBuf>,
}

/// Walk `root` for all Dockerfiles and return one [`DockerEntrypoint`] per
/// file that has a parseable `CMD` or `ENTRYPOINT`.
///
/// Call this at the start of a scan when no explicit `--entry` flags were
/// provided, then pass the collected [`DockerEntrypoint::symbols`] to
/// [`crate::analyze`].
pub fn find_dockerfile_entrypoints(root: &Path) -> Vec<DockerEntrypoint> {
    let mut dockerfiles = Vec::new();
    collect_dockerfiles(root, &mut dockerfiles);
    dockerfiles
        .into_iter()
        .filter_map(|df| parse_dockerfile_entrypoint(root, &df))
        .collect()
}

// ── file discovery ────────────────────────────────────────────────────────────

const SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "__pycache__",
    ".venv",
    "venv",
    "vendor",
    "dist",
    "build",
    ".next",
];

fn collect_dockerfiles(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if SKIP_DIRS.contains(&name) {
                continue;
            }
            collect_dockerfiles(&path, out);
        } else if is_dockerfile(&path) {
            out.push(path);
        }
    }
}

fn is_dockerfile(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
        return false;
    };
    name == "Dockerfile" || name.starts_with("Dockerfile.")
}

// ── Dockerfile parsing ────────────────────────────────────────────────────────

fn parse_dockerfile_entrypoint(root: &Path, dockerfile: &Path) -> Option<DockerEntrypoint> {
    let content = std::fs::read_to_string(dockerfile).ok()?;

    // Later instructions override earlier ones (Docker spec).
    let mut entrypoint_tokens: Vec<String> = Vec::new();
    let mut cmd_tokens: Vec<String> = Vec::new();

    let mut pending_continuation = String::new();

    for raw_line in content.lines() {
        let line = if !pending_continuation.is_empty() {
            let joined = format!("{pending_continuation} {}", raw_line.trim());
            pending_continuation.clear();
            joined
        } else {
            raw_line.trim().to_string()
        };

        if line.starts_with('#') || line.is_empty() {
            continue;
        }

        // Handle line continuations
        if line.ends_with('\\') {
            pending_continuation = line.trim_end_matches('\\').trim().to_string();
            continue;
        }

        if let Some(rest) = strip_directive(&line, "ENTRYPOINT") {
            entrypoint_tokens = parse_instruction_tokens(rest);
        } else if let Some(rest) = strip_directive(&line, "CMD") {
            cmd_tokens = parse_instruction_tokens(rest);
        }
    }

    // Docker semantics: ENTRYPOINT sets the executable; CMD provides default
    // arguments to it (or is the full command when ENTRYPOINT is absent).
    let raw_cmd: Vec<String> = if !entrypoint_tokens.is_empty() {
        let mut combined = entrypoint_tokens;
        combined.extend(cmd_tokens);
        combined
    } else {
        cmd_tokens
    };

    if raw_cmd.is_empty() {
        return None;
    }

    let (symbols, source_file) = extract_symbols(&raw_cmd, root);
    Some(DockerEntrypoint {
        dockerfile: dockerfile.to_path_buf(),
        raw_cmd,
        symbols,
        source_file,
    })
}

fn strip_directive<'a>(line: &'a str, directive: &str) -> Option<&'a str> {
    let rest = line.strip_prefix(directive)?;
    // Must be followed by whitespace, not a longer identifier (e.g. "CMD_RUN")
    let rest = rest.strip_prefix(|c: char| c.is_ascii_whitespace())?;
    Some(rest.trim())
}

/// Parse exec form `["a", "b"]` or shell form `a b c` into a token list.
fn parse_instruction_tokens(s: &str) -> Vec<String> {
    if s.starts_with('[') {
        serde_json::from_str::<Vec<String>>(s).unwrap_or_default()
    } else {
        s.split_whitespace().map(String::from).collect()
    }
}

// ── symbol extraction ─────────────────────────────────────────────────────────

fn extract_symbols(cmd: &[String], root: &Path) -> (Vec<String>, Option<PathBuf>) {
    let tokens = effective_command(cmd);
    let Some(exe) = tokens.first() else {
        return (Vec::new(), None);
    };
    let args = &tokens[1..];
    let exe_name = Path::new(exe.as_str())
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(exe.as_str());

    match exe_name {
        "python" | "python3" => python_symbols(root, args),
        "uvicorn" => uvicorn_symbols(root, args),
        "gunicorn" => gunicorn_symbols(root, args),
        "node" | "nodejs" => script_stem_symbols(root, args),
        "bun" => bun_symbols(root, args),
        "deno" => deno_symbols(root, args),
        "java" => java_symbols(args),
        _ => (Vec::new(), None),
    }
}

/// Strip shell/env wrapper tokens so `exec python ...` or `VAR=val node ...`
/// still resolve correctly. Returns `&[]` for opaque `sh -c "..."` forms.
fn effective_command(cmd: &[String]) -> &[String] {
    let mut s = cmd;
    loop {
        let Some(head) = s.first() else { break };
        match head.as_str() {
            "sh" | "bash" | "ash" => {
                // `sh -c "..."` — the inner string is opaque, bail out
                if s.get(1).map(|a| a.as_str()) == Some("-c") {
                    return &[];
                }
                s = &s[1..];
            }
            "exec" | "env" => s = &s[1..],
            _ if head.contains('=') => s = &s[1..], // VAR=val prefix
            _ => break,
        }
    }
    s
}

// ── language-specific extractors ──────────────────────────────────────────────

/// `python app.py` → stem of script file
/// `python -m uvicorn main:app` → delegate to uvicorn extractor
/// `python -m module` → module name as symbol hint
fn python_symbols(root: &Path, args: &[String]) -> (Vec<String>, Option<PathBuf>) {
    let mut iter = args.iter();
    while let Some(arg) = iter.next() {
        if arg == "-m" {
            let Some(module) = iter.next() else {
                return (Vec::new(), None);
            };
            let remaining: Vec<String> = iter.cloned().collect();
            return match module.as_str() {
                "uvicorn" => uvicorn_symbols(root, &remaining),
                "gunicorn" => gunicorn_symbols(root, &remaining),
                _ => {
                    let file = resolve_python_module(root, module);
                    let sym = module_stem(module);
                    (sym.into_iter().collect(), file)
                }
            };
        } else if !arg.starts_with('-') {
            // Positional script file
            let file = resolve_source_file(root, arg);
            let stem = file_stem_string(arg);
            return (stem.into_iter().collect(), file);
        }
        // Other short flags (-u, -O, -W, …) — skip
    }
    (Vec::new(), None)
}

/// `uvicorn main:app --host 0.0.0.0` → symbol `app`, source `main.py`
/// `uvicorn main:app` where `main` is dotted → still extracts `app`
fn uvicorn_symbols(root: &Path, args: &[String]) -> (Vec<String>, Option<PathBuf>) {
    // First non-flag argument is the app spec `module:callable`
    match args.iter().find(|a| !a.starts_with('-')) {
        Some(spec) => split_module_symbol(root, spec),
        None => (Vec::new(), None),
    }
}

/// `gunicorn -w 4 -b 0.0.0.0:8000 wsgi:app` → symbol `app`, source `wsgi.py`
fn gunicorn_symbols(root: &Path, args: &[String]) -> (Vec<String>, Option<PathBuf>) {
    // Flags that consume the next token as their value
    const VALUE_FLAGS: &[&str] = &[
        "-w", "--workers", "-b", "--bind", "-k", "--worker-class",
        "-t", "--timeout", "-c", "--config", "--log-level", "--access-logfile",
        "--error-logfile", "-p", "--pid", "--preload",
    ];
    let mut skip_next = false;
    for arg in args {
        if skip_next {
            skip_next = false;
            continue;
        }
        if arg.starts_with('-') {
            if VALUE_FLAGS.contains(&arg.as_str()) {
                skip_next = true;
            }
            continue;
        }
        // First positional: the app spec
        return split_module_symbol(root, arg);
    }
    (Vec::new(), None)
}

/// Generic script stem extractor for Node.js, Deno (after subcommand stripping).
fn script_stem_symbols(root: &Path, args: &[String]) -> (Vec<String>, Option<PathBuf>) {
    match args.iter().find(|a| !a.starts_with('-')) {
        Some(script) => {
            let file = resolve_source_file(root, script);
            let stem = file_stem_string(script);
            (stem.into_iter().collect(), file)
        }
        None => (Vec::new(), None),
    }
}

/// `bun run src/index.ts` or `bun src/index.ts` or `bun start`
fn bun_symbols(root: &Path, args: &[String]) -> (Vec<String>, Option<PathBuf>) {
    let mut iter = args.iter();
    let Some(first) = iter.next() else {
        return (Vec::new(), None);
    };
    let script = if matches!(first.as_str(), "run" | "start" | "x") {
        match iter.find(|a| !a.starts_with('-') && a.contains('.')) {
            Some(s) => s,
            None => return (Vec::new(), None),
        }
    } else if !first.starts_with('-') && first.contains('.') {
        first
    } else {
        return (Vec::new(), None);
    };
    let file = resolve_source_file(root, script);
    let stem = file_stem_string(script);
    (stem.into_iter().collect(), file)
}

/// `deno run src/main.ts` or `deno task start` (opaque, skip)
fn deno_symbols(root: &Path, args: &[String]) -> (Vec<String>, Option<PathBuf>) {
    // Only handle `deno run <file>` — `deno task` is too indirect
    let mut iter = args.iter();
    match iter.next().map(|s| s.as_str()) {
        Some("run") => script_stem_symbols(root, iter.as_slice()),
        _ => (Vec::new(), None),
    }
}

/// `java -jar app.jar` → nothing useful
/// `java com.example.MainClass` → `MainClass`
fn java_symbols(args: &[String]) -> (Vec<String>, Option<PathBuf>) {
    let mut skip_next = false;
    for arg in args {
        if skip_next {
            skip_next = false;
            continue;
        }
        if matches!(arg.as_str(), "-jar" | "-cp" | "-classpath" | "--classpath") {
            skip_next = true;
            continue;
        }
        if arg.starts_with('-') {
            continue;
        }
        // Fully qualified class name — simple name is the last component
        if arg == "-jar" {
            // next token is the jar, not a class name
            skip_next = true;
            continue;
        }
        let simple = arg.split('.').last().map(String::from);
        return (simple.into_iter().collect(), None);
    }
    (Vec::new(), None)
}

// ── utilities ─────────────────────────────────────────────────────────────────

/// Split `module:symbol` → symbols=["symbol"], source=<module resolved to .py>
/// For a bare module with no colon, return an empty symbol list but still
/// resolve the source file.
fn split_module_symbol(root: &Path, spec: &str) -> (Vec<String>, Option<PathBuf>) {
    if let Some((module, symbol)) = spec.split_once(':') {
        let file = resolve_python_module(root, module);
        (vec![symbol.to_string()], file)
    } else {
        let file = resolve_python_module(root, spec);
        (Vec::new(), file)
    }
}

/// `foo.bar.baz` → `Some("baz")`
fn module_stem(module: &str) -> Option<String> {
    module.split('.').last().map(String::from)
}

fn file_stem_string(path: &str) -> Option<String> {
    Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .map(String::from)
}

/// Try to map a Python dotted module name to a `.py` file under `root`.
fn resolve_python_module(root: &Path, module: &str) -> Option<PathBuf> {
    // `foo.bar` → `foo/bar.py`
    let rel: PathBuf = module.replace('.', "/").into();
    let candidate = root.join(rel.with_extension("py"));
    if candidate.exists() {
        return Some(candidate);
    }
    // Also try just the last component (common for single-file projects)
    let last = module.split('.').last()?;
    let candidate2 = root.join(format!("{last}.py"));
    if candidate2.exists() {
        return Some(candidate2);
    }
    None
}

fn resolve_source_file(root: &Path, rel: &str) -> Option<PathBuf> {
    let candidate = root.join(rel);
    if candidate.exists() { Some(candidate) } else { None }
}

// ── tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn tokens(s: &str) -> Vec<String> {
        s.split_whitespace().map(String::from).collect()
    }

    #[test]
    fn parse_exec_form() {
        let t = parse_instruction_tokens(r#"["uvicorn", "main:app", "--host", "0.0.0.0"]"#);
        assert_eq!(t, ["uvicorn", "main:app", "--host", "0.0.0.0"]);
    }

    #[test]
    fn parse_shell_form() {
        let t = parse_instruction_tokens("uvicorn main:app --host 0.0.0.0");
        assert_eq!(t, ["uvicorn", "main:app", "--host", "0.0.0.0"]);
    }

    #[test]
    fn uvicorn_extracts_symbol() {
        let root = Path::new("/fake");
        let args = tokens("main:app --host 0.0.0.0");
        let (syms, _) = uvicorn_symbols(root, &args);
        assert_eq!(syms, ["app"]);
    }

    #[test]
    fn uvicorn_factory_extracts_symbol() {
        let root = Path::new("/fake");
        let args = tokens("api.main:create_app --host 0.0.0.0");
        let (syms, _) = uvicorn_symbols(root, &args);
        assert_eq!(syms, ["create_app"]);
    }

    #[test]
    fn gunicorn_extracts_symbol() {
        let root = Path::new("/fake");
        let args = tokens("-w 4 -b 0.0.0.0:8000 wsgi:application");
        let (syms, _) = gunicorn_symbols(root, &args);
        assert_eq!(syms, ["application"]);
    }

    #[test]
    fn python_module_uvicorn_delegate() {
        let root = Path::new("/fake");
        let args = tokens("-m uvicorn main:app");
        let (syms, _) = python_symbols(root, &args);
        assert_eq!(syms, ["app"]);
    }

    #[test]
    fn java_class_extracts_simple_name() {
        let args = tokens("-cp /app/classes com.example.server.MainServer");
        let (syms, _) = java_symbols(&args);
        assert_eq!(syms, ["MainServer"]);
    }

    #[test]
    fn effective_command_strips_exec() {
        let cmd: Vec<String> = tokens("exec uvicorn main:app");
        assert_eq!(effective_command(&cmd), &["uvicorn", "main:app"]);
    }

    #[test]
    fn effective_command_bails_on_sh_c() {
        let cmd: Vec<String> = tokens("sh -c uvicorn main:app");
        assert!(effective_command(&cmd).is_empty());
    }
}
