//! Pick the **single test command** the profiler will run.
//!
//! Profiling against ad-hoc HTTP load (`drive_load`) is one mode; profiling
//! a *test* run is another. This tool exists for the second mode: given a
//! project root and an optional target hint (a test file path or a substring
//! the test name should contain), return the exact shell command + the test
//! file paths that command will execute.
//!
//! Heuristics, in order:
//!
//!   1. **Explicit target**: if the caller passed `target_file`, ensure it
//!      exists and use it directly. We then pick the runner from
//!      `package.json` / `pyproject.toml`. This is the path the LLM takes
//!      when the user said "profile this specific test."
//!
//!   2. **Implicit target**: walk the project for test files
//!      (`*.test.ts`, `*.spec.ts`, `*_test.py`, `tests/test_*.py`, …) and
//!      surface the candidates. The agent then names a candidate.
//!
//!   3. **Fallback**: no target → the project's `test` script command,
//!      verbatim. Profilers can run the whole suite even if it's slow.

use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use super::ToolManifest;

pub const NAME: &str = "find_test_runner_for_profiling";
pub const DESCRIPTION: &str =
    "Pick the test command and test files to run under the profiler. Optionally pass a \
     `target_file` (absolute path to a test file) to lock the run to one test. With no target, \
     returns the project's default test command plus a list of candidate test files for the \
     model to pick from. Read-only.";
pub const PARAMETERS: &str = r#"{
  "type": "object",
  "properties": {
    "path": {"type": "string", "description": "Absolute path to the project root."},
    "target_file": {"type": "string", "description": "Optional absolute path to a single test file to focus on."},
    "name_filter": {"type": "string", "description": "Optional substring the test runner should match against test names."},
    "max_candidates": {"type": "integer", "description": "Cap on candidate test files returned (default 30, max 200)."}
  },
  "required": ["path"]
}"#;

#[derive(Debug, Deserialize)]
pub struct Args {
    pub path: String,
    pub target_file: Option<String>,
    pub name_filter: Option<String>,
    pub max_candidates: Option<u32>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum TestRunner {
    BunTest,
    Vitest,
    Jest,
    NodeTest,
    Pytest,
    CargoTest,
    GoTest,
    Mvn,
    Gradle,
    Rspec,
    Unknown,
}

#[derive(Debug, Serialize)]
pub struct Output {
    pub root: String,
    pub runner: TestRunner,
    /// The shell command (split into argv) the profiler should execute. The
    /// model passes this to `exec_in_container` once a profiler is attached.
    pub command: Vec<String>,
    /// Working directory relative to the container's source root. Usually
    /// `.` but compose monorepos may want a workspace dir.
    pub working_dir: String,
    /// Test files we consider candidates. If `target_file` was given,
    /// exactly one entry; otherwise every file matching the runner's pattern.
    pub candidate_tests: Vec<String>,
    /// Set when the caller's `target_file` couldn't be resolved — agent
    /// should re-pick from `candidate_tests`.
    pub target_not_found: bool,
}

pub fn manifest() -> ToolManifest {
    ToolManifest {
        name: NAME,
        description: DESCRIPTION,
        parameters: PARAMETERS,
    }
}

const DEFAULT_CAP: u32 = 30;
const MAX_CAP: u32 = 200;

pub async fn run(args: Args) -> Result<Output> {
    let root = PathBuf::from(&args.path);
    if !root.is_dir() {
        anyhow::bail!("not a directory: {}", root.display());
    }

    // Step 1: pick the runner from manifest signals.
    let runner = pick_runner(&root)?;

    // Step 2: handle the explicit-target path.
    let cap = args.max_candidates.unwrap_or(DEFAULT_CAP).min(MAX_CAP) as usize;
    let mut target_not_found = false;
    let candidates: Vec<String> = if let Some(target) = args.target_file.as_deref() {
        let abs = PathBuf::from(target);
        if abs.is_file() {
            vec![relativise(&root, &abs)]
        } else {
            // Caller asked for a file we can't see — surface that instead of
            // silently falling back, because they probably meant something
            // specific.
            target_not_found = true;
            walk_tests(&root, runner, cap)
        }
    } else {
        walk_tests(&root, runner, cap)
    };

    // Step 3: build the runner-specific argv.
    let single_target = if !target_not_found && args.target_file.is_some() {
        candidates.first().cloned()
    } else {
        None
    };
    let command = build_command(runner, single_target.as_deref(), args.name_filter.as_deref());

    Ok(Output {
        root: root.display().to_string(),
        runner,
        command,
        working_dir: ".".into(),
        candidate_tests: candidates,
        target_not_found,
    })
}

fn pick_runner(root: &Path) -> Result<TestRunner> {
    // JS/TS: read package.json scripts/devDependencies for the strongest
    // signal. Bun's `bun test`
    let pj = root.join("package.json");
    if pj.is_file() {
        let raw = std::fs::read_to_string(&pj).with_context(|| format!("read {}", pj.display()))?;
        let v: serde_json::Value = serde_json::from_str(&raw).context("parse package.json")?;
        let test_script = v
            .get("scripts")
            .and_then(|s| s.get("test"))
            .and_then(|s| s.as_str())
            .unwrap_or("");
        if test_script.contains("vitest") {
            return Ok(TestRunner::Vitest);
        }
        if test_script.contains("jest") {
            return Ok(TestRunner::Jest);
        }
        if test_script.contains("node --test") || test_script.contains("node:test") {
            return Ok(TestRunner::NodeTest);
        }
        if test_script.starts_with("bun test") || test_script == "bun" || test_script.contains(" bun ") {
            return Ok(TestRunner::BunTest);
        }
        // Fallbacks based on the lockfile.
        if root.join("bun.lock").is_file() || root.join("bun.lockb").is_file() {
            return Ok(TestRunner::BunTest);
        }
        let deps = collect_dep_names(&v);
        if deps.iter().any(|d| d == "vitest") {
            return Ok(TestRunner::Vitest);
        }
        if deps.iter().any(|d| d == "jest") {
            return Ok(TestRunner::Jest);
        }
        return Ok(TestRunner::NodeTest);
    }

    if root.join("pyproject.toml").is_file() || root.join("requirements.txt").is_file() {
        return Ok(TestRunner::Pytest);
    }
    if root.join("Cargo.toml").is_file() {
        return Ok(TestRunner::CargoTest);
    }
    if root.join("go.mod").is_file() {
        return Ok(TestRunner::GoTest);
    }
    if root.join("pom.xml").is_file() {
        return Ok(TestRunner::Mvn);
    }
    if root.join("build.gradle").is_file() || root.join("build.gradle.kts").is_file() {
        return Ok(TestRunner::Gradle);
    }
    if root.join("Gemfile").is_file() {
        return Ok(TestRunner::Rspec);
    }
    Ok(TestRunner::Unknown)
}

fn collect_dep_names(v: &serde_json::Value) -> Vec<String> {
    let mut out = Vec::new();
    for k in &["dependencies", "devDependencies", "peerDependencies"] {
        if let Some(obj) = v.get(*k).and_then(|d| d.as_object()) {
            out.extend(obj.keys().cloned());
        }
    }
    out
}

fn build_command(runner: TestRunner, target: Option<&str>, name_filter: Option<&str>) -> Vec<String> {
    match runner {
        TestRunner::BunTest => {
            let mut argv = vec!["bun".into(), "test".into()];
            if let Some(t) = target {
                argv.push(t.into());
            }
            if let Some(name) = name_filter {
                argv.push("--test-name-pattern".into());
                argv.push(name.into());
            }
            argv
        }
        TestRunner::Vitest => {
            let mut argv = vec!["bunx".into(), "vitest".into(), "run".into()];
            if let Some(t) = target {
                argv.push(t.into());
            }
            if let Some(name) = name_filter {
                argv.push("-t".into());
                argv.push(name.into());
            }
            argv
        }
        TestRunner::Jest => {
            let mut argv = vec!["bunx".into(), "jest".into()];
            if let Some(t) = target {
                argv.push(t.into());
            }
            if let Some(name) = name_filter {
                argv.push("-t".into());
                argv.push(name.into());
            }
            argv
        }
        TestRunner::NodeTest => {
            let mut argv = vec!["node".into(), "--test".into()];
            if let Some(t) = target {
                argv.push(t.into());
            }
            argv
        }
        TestRunner::Pytest => {
            let mut argv = vec!["pytest".into(), "-q".into()];
            if let Some(t) = target {
                argv.push(t.into());
            }
            if let Some(name) = name_filter {
                argv.push("-k".into());
                argv.push(name.into());
            }
            argv
        }
        TestRunner::CargoTest => {
            let mut argv = vec!["cargo".into(), "test".into()];
            if let Some(t) = target {
                argv.push("--test".into());
                argv.push(stem(t));
            }
            if let Some(name) = name_filter {
                argv.push(name.into());
            }
            argv
        }
        TestRunner::GoTest => {
            let mut argv = vec!["go".into(), "test".into(), "./...".into()];
            if let Some(t) = target {
                argv = vec!["go".into(), "test".into(), t.into()];
            }
            if let Some(name) = name_filter {
                argv.push("-run".into());
                argv.push(name.into());
            }
            argv
        }
        TestRunner::Mvn => vec!["mvn".into(), "test".into()],
        TestRunner::Gradle => vec!["./gradlew".into(), "test".into()],
        TestRunner::Rspec => {
            let mut argv = vec!["bundle".into(), "exec".into(), "rspec".into()];
            if let Some(t) = target {
                argv.push(t.into());
            }
            argv
        }
        TestRunner::Unknown => vec![],
    }
}

fn walk_tests(root: &Path, runner: TestRunner, cap: usize) -> Vec<String> {
    let mut hits: Vec<String> = Vec::new();
    let ignore = ["node_modules", ".git", "target", "dist", "build", "__pycache__", ".venv"];
    walk(root, root, &mut hits, runner, cap, &ignore);
    hits
}

fn walk(root: &Path, dir: &Path, out: &mut Vec<String>, runner: TestRunner, cap: usize, ignore: &[&str]) {
    if out.len() >= cap {
        return;
    }
    let Ok(read) = std::fs::read_dir(dir) else { return };
    let mut entries: Vec<_> = read.filter_map(|e| e.ok()).collect();
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        if out.len() >= cap {
            return;
        }
        let name = entry.file_name();
        let name_s = match name.to_str() {
            Some(s) => s,
            None => continue,
        };
        if ignore.contains(&name_s) {
            continue;
        }
        let path = entry.path();
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if metadata.is_dir() {
            walk(root, &path, out, runner, cap, ignore);
        } else if is_test_file(&path, runner) {
            out.push(relativise(root, &path));
        }
    }
}

fn is_test_file(path: &Path, runner: TestRunner) -> bool {
    let name = match path.file_name().and_then(|n| n.to_str()) {
        Some(n) => n,
        None => return false,
    };
    match runner {
        TestRunner::BunTest | TestRunner::Vitest | TestRunner::Jest | TestRunner::NodeTest => {
            name.ends_with(".test.ts")
                || name.ends_with(".test.tsx")
                || name.ends_with(".test.js")
                || name.ends_with(".test.mjs")
                || name.ends_with(".spec.ts")
                || name.ends_with(".spec.js")
        }
        TestRunner::Pytest => name.starts_with("test_") && name.ends_with(".py"),
        TestRunner::CargoTest => {
            // Top-level `tests/*.rs` integration tests (we don't emit unit
            // tests here — those live alongside production source).
            path.components()
                .any(|c| c.as_os_str() == "tests")
                && name.ends_with(".rs")
        }
        TestRunner::GoTest => name.ends_with("_test.go"),
        TestRunner::Mvn | TestRunner::Gradle => {
            name.ends_with("Test.java") || name.ends_with("Tests.java") || name.ends_with("IT.java")
        }
        TestRunner::Rspec => name.ends_with("_spec.rb"),
        TestRunner::Unknown => false,
    }
}

fn relativise(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .display()
        .to_string()
}

fn stem(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(path)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tempdir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir()
            .join(format!("drift-findtest-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[tokio::test]
    async fn picks_bun_test_when_package_uses_it() {
        let dir = tempdir("bun");
        std::fs::write(
            dir.join("package.json"),
            r#"{"scripts":{"test":"bun test"}}"#,
        )
        .unwrap();
        std::fs::write(dir.join("bun.lock"), "{}").unwrap();
        std::fs::create_dir_all(dir.join("src/svc/__tests__")).unwrap();
        std::fs::write(dir.join("src/svc/__tests__/a.test.ts"), "//").unwrap();
        std::fs::write(dir.join("src/svc/__tests__/b.test.ts"), "//").unwrap();

        let out = run(Args {
            path: dir.display().to_string(),
            target_file: None,
            name_filter: None,
            max_candidates: None,
        })
        .await
        .unwrap();

        assert_eq!(out.runner, TestRunner::BunTest);
        assert_eq!(out.command, vec!["bun".to_string(), "test".to_string()]);
        assert_eq!(out.candidate_tests.len(), 2);
        assert!(out.candidate_tests.iter().all(|p| p.ends_with(".test.ts")));
    }

    #[tokio::test]
    async fn pins_to_explicit_target_file() {
        let dir = tempdir("target");
        std::fs::write(
            dir.join("package.json"),
            r#"{"scripts":{"test":"bun test"}}"#,
        )
        .unwrap();
        std::fs::create_dir_all(dir.join("src/svc/__tests__")).unwrap();
        let target = dir.join("src/svc/__tests__/specific.test.ts");
        std::fs::write(&target, "//").unwrap();
        std::fs::write(dir.join("src/svc/__tests__/other.test.ts"), "//").unwrap();

        let out = run(Args {
            path: dir.display().to_string(),
            target_file: Some(target.display().to_string()),
            name_filter: None,
            max_candidates: None,
        })
        .await
        .unwrap();

        assert_eq!(out.candidate_tests.len(), 1);
        assert!(out.candidate_tests[0].ends_with("specific.test.ts"));
        // Argv ends with the relative path.
        assert!(out.command.last().unwrap().ends_with("specific.test.ts"));
        assert!(!out.target_not_found);
    }

    #[tokio::test]
    async fn missing_target_signals_not_found_and_falls_back_to_candidates() {
        let dir = tempdir("notfound");
        std::fs::write(
            dir.join("package.json"),
            r#"{"scripts":{"test":"bun test"}}"#,
        )
        .unwrap();
        std::fs::create_dir_all(dir.join("src/__tests__")).unwrap();
        std::fs::write(dir.join("src/__tests__/x.test.ts"), "//").unwrap();

        let out = run(Args {
            path: dir.display().to_string(),
            target_file: Some("/somewhere/that/does/not/exist.test.ts".into()),
            name_filter: None,
            max_candidates: None,
        })
        .await
        .unwrap();

        assert!(out.target_not_found);
        assert_eq!(out.candidate_tests.len(), 1);
    }

    #[tokio::test]
    async fn applies_name_filter_for_bun() {
        let dir = tempdir("namefilter");
        std::fs::write(
            dir.join("package.json"),
            r#"{"scripts":{"test":"bun test"}}"#,
        )
        .unwrap();
        let out = run(Args {
            path: dir.display().to_string(),
            target_file: None,
            name_filter: Some("calculates total".into()),
            max_candidates: None,
        })
        .await
        .unwrap();
        assert!(out.command.contains(&"--test-name-pattern".to_string()));
        assert!(out.command.iter().any(|a| a == "calculates total"));
    }

    #[tokio::test]
    async fn detects_vitest_via_dep() {
        let dir = tempdir("vitest");
        std::fs::write(
            dir.join("package.json"),
            r#"{"scripts":{"test":"vitest run"},"devDependencies":{"vitest":"^1"}}"#,
        )
        .unwrap();
        let out = run(Args {
            path: dir.display().to_string(),
            target_file: None,
            name_filter: None,
            max_candidates: None,
        })
        .await
        .unwrap();
        assert_eq!(out.runner, TestRunner::Vitest);
        assert!(out.command.iter().any(|a| a == "vitest"));
    }

    #[tokio::test]
    async fn detects_pytest_for_python_project() {
        let dir = tempdir("pytest");
        std::fs::write(dir.join("pyproject.toml"), "[project]\nname='x'\n").unwrap();
        let out = run(Args {
            path: dir.display().to_string(),
            target_file: None,
            name_filter: Some("test_pricing".into()),
            max_candidates: None,
        })
        .await
        .unwrap();
        assert_eq!(out.runner, TestRunner::Pytest);
        assert!(out.command.iter().any(|a| a == "-k"));
        assert!(out.command.iter().any(|a| a == "test_pricing"));
    }

    #[tokio::test]
    async fn detects_cargo_test_for_rust_project() {
        let dir = tempdir("cargo");
        std::fs::write(dir.join("Cargo.toml"), "[package]\nname='x'\nversion='0.1.0'\n").unwrap();
        let out = run(Args {
            path: dir.display().to_string(),
            target_file: None,
            name_filter: None,
            max_candidates: None,
        })
        .await
        .unwrap();
        assert_eq!(out.runner, TestRunner::CargoTest);
        assert_eq!(out.command, vec!["cargo".to_string(), "test".to_string()]);
    }

    #[tokio::test]
    async fn caps_candidates_at_user_max() {
        let dir = tempdir("cap");
        std::fs::write(
            dir.join("package.json"),
            r#"{"scripts":{"test":"bun test"}}"#,
        )
        .unwrap();
        std::fs::create_dir_all(dir.join("src/__tests__")).unwrap();
        for i in 0..15 {
            std::fs::write(dir.join(format!("src/__tests__/t{i}.test.ts")), "//").unwrap();
        }
        let out = run(Args {
            path: dir.display().to_string(),
            target_file: None,
            name_filter: None,
            max_candidates: Some(5),
        })
        .await
        .unwrap();
        assert_eq!(out.candidate_tests.len(), 5);
    }
}
