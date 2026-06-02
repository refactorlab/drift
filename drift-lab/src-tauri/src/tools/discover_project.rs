//! File-tree-based project discovery — what `detect_runtime` does for an
//! image, this does for a directory before anything is built.
//!
//! Reads the canonical manifest files (`package.json`, `pyproject.toml`,
//! `Cargo.toml`, `go.mod`, `pom.xml`) plus a few well-known signals
//! (`bun.lock`, `pnpm-lock.yaml`, `requirements.txt`) and reports:
//!
//!   - the primary language
//!   - the package manager (npm/yarn/pnpm/bun/uv/pip/cargo/go/maven)
//!   - any `start` / `dev` / `test` scripts the agent will need to know about
//!   - frameworks hinted by dependency keys (fastapi, express, hono, etc.)
//!   - whether tests appear to exist (`test:*` script + a tests directory)
//!
//! The agent uses this as its **first** discovery step on a new project —
//! it's faster than `detect_runtime` (no Docker), and feeds back enough info
//! to plan the rest of the scan.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use super::ToolManifest;

pub const NAME: &str = "discover_project";
pub const DESCRIPTION: &str =
    "Inspect a project directory's manifest files (package.json, pyproject.toml, Cargo.toml, etc.) \
     and report the language, package manager, runnable scripts, framework hints, and whether \
     tests appear present. Read-only — pairs well with `list_directory` for layout discovery.";
pub const PARAMETERS: &str = r#"{
  "type": "object",
  "properties": {
    "path": {"type": "string", "description": "Absolute path to the project root."}
  },
  "required": ["path"]
}"#;

#[derive(Debug, Deserialize)]
pub struct Args {
    pub path: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Language {
    JavaScript,
    TypeScript,
    Python,
    Rust,
    Go,
    Java,
    Ruby,
    Unknown,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PackageManager {
    Bun,
    Pnpm,
    Yarn,
    Npm,
    Uv,
    Pip,
    Poetry,
    Cargo,
    Go,
    Maven,
    Gradle,
    Bundler,
    Unknown,
}

#[derive(Debug, Serialize)]
pub struct DiscoveredScript {
    pub name: String,
    pub command: String,
}

#[derive(Debug, Serialize)]
pub struct Output {
    pub root: String,
    pub language: Language,
    pub package_manager: PackageManager,
    /// Every `scripts` entry from `package.json` (or `[tool.poetry.scripts]`,
    /// etc.). The agent picks `start`/`dev`/`test` itself rather than us
    /// guessing.
    pub scripts: Vec<DiscoveredScript>,
    /// Sorted list of framework hints derived from dependency names. Keep
    /// this short — the agent uses it as a steer for the profiler choice.
    pub frameworks: Vec<String>,
    /// Manifest files we actually looked at (relative to `root`).
    pub manifests: Vec<String>,
    /// Heuristic — is there at least one `test*` directory or `*.test.*`
    /// glob? The agent uses this to decide whether to call
    /// `find_test_runner_for_profiling`.
    pub has_tests: bool,
    /// True if we found a Dockerfile or compose file at the root. Saves a
    /// round-trip — the agent doesn't need to call `find_image` again to
    /// know.
    pub has_dockerfile: bool,
}

pub fn manifest() -> ToolManifest {
    ToolManifest {
        name: NAME,
        description: DESCRIPTION,
        parameters: PARAMETERS,
    }
}

pub async fn run(args: Args) -> Result<Output> {
    let root = PathBuf::from(&args.path);
    if !root.is_dir() {
        anyhow::bail!("not a directory: {}", root.display());
    }

    let mut out = Output {
        root: root.display().to_string(),
        language: Language::Unknown,
        package_manager: PackageManager::Unknown,
        scripts: Vec::new(),
        frameworks: Vec::new(),
        manifests: Vec::new(),
        has_tests: detect_tests(&root),
        has_dockerfile: detect_dockerfile(&root),
    };

    // Order matters — first match wins for "primary language" but we still
    // record every manifest we find (a polyglot repo gets all of them).
    if let Ok((lang, pm, scripts, frameworks)) = inspect_package_json(&root) {
        out.manifests.push("package.json".into());
        out.language = lang;
        out.package_manager = pm;
        out.scripts = scripts;
        out.frameworks = frameworks;
    } else if let Ok((lang, pm, frameworks)) = inspect_pyproject(&root) {
        out.manifests.push("pyproject.toml".into());
        out.language = lang;
        out.package_manager = pm;
        out.frameworks = frameworks;
    } else if root.join("Cargo.toml").is_file() {
        out.manifests.push("Cargo.toml".into());
        out.language = Language::Rust;
        out.package_manager = PackageManager::Cargo;
    } else if root.join("go.mod").is_file() {
        out.manifests.push("go.mod".into());
        out.language = Language::Go;
        out.package_manager = PackageManager::Go;
    } else if root.join("pom.xml").is_file() {
        out.manifests.push("pom.xml".into());
        out.language = Language::Java;
        out.package_manager = PackageManager::Maven;
    } else if root.join("build.gradle").is_file() || root.join("build.gradle.kts").is_file() {
        out.manifests.push("build.gradle".into());
        out.language = Language::Java;
        out.package_manager = PackageManager::Gradle;
    } else if root.join("Gemfile").is_file() {
        out.manifests.push("Gemfile".into());
        out.language = Language::Ruby;
        out.package_manager = PackageManager::Bundler;
    }

    // Even if a JS project, `requirements.txt` next to it (a polyglot service)
    // is worth noting.
    if root.join("requirements.txt").is_file() && !out.manifests.iter().any(|m| m == "pyproject.toml") {
        out.manifests.push("requirements.txt".into());
        if matches!(out.language, Language::Unknown) {
            out.language = Language::Python;
            out.package_manager = PackageManager::Pip;
        }
    }

    // For JS projects, distinguish JS vs TS by the presence of a tsconfig
    // or any *.ts source. Monorepo workspaces are often TypeScript-heavy; this
    // matters because the test runner choice differs.
    if matches!(out.language, Language::JavaScript) && (root.join("tsconfig.json").is_file() || any_ts_source(&root)) {
        out.language = Language::TypeScript;
    }

    Ok(out)
}

fn detect_tests(root: &Path) -> bool {
    for candidate in &["__tests__", "tests", "test", "spec"] {
        if root.join(candidate).is_dir() {
            return true;
        }
    }
    // Also accept `src/**/__tests__` one level deep — common in monorepos.
    if let Ok(rd) = std::fs::read_dir(root.join("src")) {
        for entry in rd.flatten() {
            let p = entry.path();
            if p.is_dir()
                && (p.join("__tests__").is_dir() || p.join("tests").is_dir())
            {
                return true;
            }
        }
    }
    false
}

fn detect_dockerfile(root: &Path) -> bool {
    for f in &["Dockerfile", "Containerfile", "docker-compose.yml", "compose.yaml", "docker-compose.yaml"] {
        if root.join(f).is_file() {
            return true;
        }
    }
    false
}

fn inspect_package_json(
    root: &Path,
) -> Result<(Language, PackageManager, Vec<DiscoveredScript>, Vec<String>)> {
    let pj = root.join("package.json");
    let raw = std::fs::read_to_string(&pj).with_context(|| format!("read {}", pj.display()))?;
    let v: serde_json::Value = serde_json::from_str(&raw).context("parse package.json")?;

    let scripts = v
        .get("scripts")
        .and_then(|s| s.as_object())
        .map(|obj| {
            obj.iter()
                .filter_map(|(k, val)| {
                    val.as_str().map(|s| DiscoveredScript {
                        name: k.clone(),
                        command: s.to_string(),
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    // Pick the package manager. Local lockfile wins; otherwise fall back to
    // *script content* signals — that catches monorepo workspaces where
    // `bun.lock` lives at the monorepo root, not at this directory's root, but
    // `"test": "bun test"` is unambiguous. Last resort: walk up the tree a few
    // levels looking for a workspace-root lockfile.
    let pm = if root.join("bun.lock").is_file() || root.join("bun.lockb").is_file() {
        PackageManager::Bun
    } else if root.join("pnpm-lock.yaml").is_file() {
        PackageManager::Pnpm
    } else if root.join("yarn.lock").is_file() {
        PackageManager::Yarn
    } else if root.join("package-lock.json").is_file() {
        PackageManager::Npm
    } else if scripts_use_bun(&scripts) {
        PackageManager::Bun
    } else {
        ancestor_lockfile(root).unwrap_or(PackageManager::Npm)
    };

    let mut deps_keys: Vec<String> = Vec::new();
    for key in &["dependencies", "devDependencies", "peerDependencies"] {
        if let Some(obj) = v.get(*key).and_then(|d| d.as_object()) {
            deps_keys.extend(obj.keys().cloned());
        }
    }
    let frameworks = framework_hints_from_deps(&deps_keys);

    // Default to JavaScript; the caller upgrades to TypeScript if there's a
    // tsconfig or *.ts source.
    Ok((Language::JavaScript, pm, scripts, frameworks))
}

fn inspect_pyproject(root: &Path) -> Result<(Language, PackageManager, Vec<String>)> {
    let path = root.join("pyproject.toml");
    let raw = std::fs::read_to_string(&path).with_context(|| format!("read {}", path.display()))?;
    // Cheap inspection — we don't pull in a TOML crate just for hints.
    let pm = if root.join("uv.lock").is_file() || raw.contains("[tool.uv]") {
        PackageManager::Uv
    } else if raw.contains("[tool.poetry]") {
        PackageManager::Poetry
    } else {
        PackageManager::Pip
    };
    let frameworks = python_framework_hints(&raw);
    Ok((Language::Python, pm, frameworks))
}

fn framework_hints_from_deps(deps: &[String]) -> Vec<String> {
    let map: HashMap<&str, &str> = [
        ("express", "express"),
        ("fastify", "fastify"),
        ("hono", "hono"),
        ("nestjs", "nestjs"),
        ("@nestjs/core", "nestjs"),
        ("next", "next.js"),
        ("react", "react"),
        ("vue", "vue"),
        ("svelte", "svelte"),
        ("@opentelemetry/api", "opentelemetry"),
        ("pino", "pino"),
        ("ioredis", "ioredis"),
        ("redis", "redis"),
        ("rabbitmq-client", "rabbitmq"),
        ("amqplib", "rabbitmq"),
        ("kafkajs", "kafka"),
        ("@bufbuild/protobuf", "protobuf"),
        ("zod", "zod"),
        ("stripe", "stripe-sdk"),
        ("@shopify/shopify-api", "shopify-sdk"),
    ]
    .into_iter()
    .collect();

    let mut out: Vec<String> = deps
        .iter()
        .filter_map(|d| map.get(d.as_str()).map(|v| v.to_string()))
        .collect();
    out.sort();
    out.dedup();
    out
}

fn python_framework_hints(pyproject: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for (needle, label) in [
        ("fastapi", "fastapi"),
        ("flask", "flask"),
        ("django", "django"),
        ("starlette", "starlette"),
        ("uvicorn", "uvicorn"),
        ("gunicorn", "gunicorn"),
        ("celery", "celery"),
        ("sqlalchemy", "sqlalchemy"),
    ] {
        if pyproject.to_lowercase().contains(needle) {
            out.push(label.to_string());
        }
    }
    out.sort();
    out.dedup();
    out
}

/// True if any of the project's scripts invokes `bun` directly. Catches the
/// monorepo-workspace pattern where the lockfile is one level up but every
/// script reads `bun --preload ...` / `bun test` / `bun run`.
fn scripts_use_bun(scripts: &[DiscoveredScript]) -> bool {
    scripts.iter().any(|s| {
        let cmd = &s.command;
        cmd.starts_with("bun ")
            || cmd.starts_with("bun\t")
            || cmd.contains(" bun ")
            || cmd == "bun"
    })
}

/// Walk up at most 4 parent directories looking for a workspace lockfile.
/// Returns the first match; `None` if nothing found within range.
fn ancestor_lockfile(start: &Path) -> Option<PackageManager> {
    let mut cur = start.parent();
    for _ in 0..4 {
        let dir = cur?;
        if dir.join("bun.lock").is_file() || dir.join("bun.lockb").is_file() {
            return Some(PackageManager::Bun);
        }
        if dir.join("pnpm-lock.yaml").is_file() {
            return Some(PackageManager::Pnpm);
        }
        if dir.join("yarn.lock").is_file() {
            return Some(PackageManager::Yarn);
        }
        if dir.join("package-lock.json").is_file() {
            return Some(PackageManager::Npm);
        }
        cur = dir.parent();
    }
    None
}

fn any_ts_source(root: &Path) -> bool {
    let src = root.join("src");
    let dir = if src.is_dir() { src } else { root.to_path_buf() };
    let Ok(rd) = std::fs::read_dir(&dir) else {
        return false;
    };
    for entry in rd.flatten().take(64) {
        let p = entry.path();
        if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
            if ext == "ts" || ext == "tsx" {
                return true;
            }
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tempdir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir()
            .join(format!("drift-discover-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[tokio::test]
    async fn detects_bun_typescript_project_with_test_script() {
        // Mirror a real monorepo service's shape: bun + TS + Dockerfile.
        let dir = tempdir("bun-ts");
        std::fs::write(
            dir.join("package.json"),
            r#"{
              "name":"x","main":"src/index.ts",
              "scripts":{"start":"bun run","test":"bun test","dev":"bun --hot src/index.ts"},
              "dependencies":{"hono":"^4","ioredis":"^5","@opentelemetry/api":"^1"}
            }"#,
        )
        .unwrap();
        std::fs::write(dir.join("bun.lock"), "{}").unwrap();
        std::fs::write(dir.join("tsconfig.json"), "{}").unwrap();
        std::fs::create_dir_all(dir.join("src/svc/__tests__")).unwrap();
        std::fs::write(dir.join("src/svc/__tests__/a.test.ts"), "//").unwrap();
        std::fs::write(dir.join("Dockerfile"), "FROM bun\n").unwrap();

        let out = run(Args {
            path: dir.display().to_string(),
        })
        .await
        .unwrap();

        assert_eq!(out.language, Language::TypeScript);
        assert_eq!(out.package_manager, PackageManager::Bun);
        assert!(out.has_tests);
        assert!(out.has_dockerfile);
        assert!(out.scripts.iter().any(|s| s.name == "test"));
        assert!(out.frameworks.contains(&"hono".to_string()));
        assert!(out.frameworks.contains(&"ioredis".to_string()));
    }

    #[tokio::test]
    async fn detects_bun_via_test_script_when_no_local_lockfile() {
        // Mirrors a monorepo workspace: the lockfile lives at the monorepo
        // root, so this dir only has package.json + tsconfig.
        let dir = tempdir("ws-no-lock");
        std::fs::write(
            dir.join("package.json"),
            r#"{
              "name":"x","main":"src/index.ts",
              "scripts":{"start":"PORT=3000 bun --preload src/preload.ts src/server.ts","test":"bun test"}
            }"#,
        )
        .unwrap();
        std::fs::write(dir.join("tsconfig.json"), "{}").unwrap();
        let out = run(Args { path: dir.display().to_string() }).await.unwrap();
        assert_eq!(out.package_manager, PackageManager::Bun);
        assert_eq!(out.language, Language::TypeScript);
    }

    #[tokio::test]
    async fn ancestor_lockfile_promotes_to_workspace_pm() {
        // Workspace root has bun.lock; the actual package.json sits in a
        // child dir with no lockfile of its own and no script-level bun hint.
        // Should still report Bun.
        let root = tempdir("ws-root");
        std::fs::write(root.join("bun.lock"), "{}").unwrap();
        let child = root.join("workspaces/svc");
        std::fs::create_dir_all(&child).unwrap();
        std::fs::write(child.join("package.json"), r#"{"scripts":{}}"#).unwrap();
        let out = run(Args { path: child.display().to_string() }).await.unwrap();
        assert_eq!(out.package_manager, PackageManager::Bun);
    }

    #[tokio::test]
    async fn distinguishes_pnpm_from_bun() {
        let dir = tempdir("pnpm");
        std::fs::write(dir.join("package.json"), r#"{"scripts":{}}"#).unwrap();
        std::fs::write(dir.join("pnpm-lock.yaml"), "lockfileVersion: '6.0'").unwrap();
        let out = run(Args { path: dir.display().to_string() }).await.unwrap();
        assert_eq!(out.package_manager, PackageManager::Pnpm);
    }

    #[tokio::test]
    async fn detects_python_pyproject_with_uv() {
        let dir = tempdir("py-uv");
        std::fs::write(
            dir.join("pyproject.toml"),
            "[project]\nname='x'\n[tool.uv]\n\ndependencies=['fastapi','sqlalchemy']\n",
        )
        .unwrap();
        let out = run(Args { path: dir.display().to_string() }).await.unwrap();
        assert_eq!(out.language, Language::Python);
        assert_eq!(out.package_manager, PackageManager::Uv);
        assert!(out.frameworks.contains(&"fastapi".to_string()));
    }

    #[tokio::test]
    async fn detects_rust_cargo_project() {
        let dir = tempdir("rust");
        std::fs::write(dir.join("Cargo.toml"), "[package]\nname='x'\nversion='0.1.0'\n").unwrap();
        let out = run(Args { path: dir.display().to_string() }).await.unwrap();
        assert_eq!(out.language, Language::Rust);
        assert_eq!(out.package_manager, PackageManager::Cargo);
    }

    #[tokio::test]
    async fn unknown_when_no_signals() {
        let dir = tempdir("empty");
        let out = run(Args { path: dir.display().to_string() }).await.unwrap();
        assert_eq!(out.language, Language::Unknown);
        assert_eq!(out.package_manager, PackageManager::Unknown);
        assert!(!out.has_tests);
        assert!(!out.has_dockerfile);
    }

    #[tokio::test]
    async fn errors_when_path_missing() {
        let err = run(Args {
            path: "/missing/path/zzz".into(),
        })
        .await
        .unwrap_err();
        assert!(err.to_string().contains("not a directory"));
    }
}
