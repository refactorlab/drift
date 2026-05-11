//! Diagnostic — verify Docker is installed and the daemon is reachable.
//!
//! Every later stage (`detect_runtime`, `install_profiler`, `run_profiling`,
//! …) needs a live Docker daemon. When the daemon isn't running the failure
//! mode used to be a cryptic bollard error mid-pipeline. Running this once at
//! the top of the agent loop turns that into a clear "Docker is/isn't here"
//! signal the UI can render as a prompt to install or start Docker Desktop.
//!
//! Returns:
//!   - whether the `docker` CLI is on `PATH` (and where)
//!   - whether the daemon is reachable via the local socket
//!   - daemon + client version when available
//!   - a human-readable install hint when something's missing

use std::path::PathBuf;
use std::process::Stdio;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use tokio::process::Command;

use super::ToolManifest;
use crate::docker;

pub const NAME: &str = "check_docker";
pub const DESCRIPTION: &str =
    "Check whether Docker is installed on this machine and whether its daemon is reachable. \
     Call this first when the project is containerised — every later stage needs a working \
     Docker daemon. Returns the binary path, daemon version, and an install hint if Docker \
     is missing or not running.";
pub const PARAMETERS: &str = r#"{
  "type": "object",
  "properties": {}
}"#;

#[derive(Debug, Default, Deserialize)]
pub struct Args {}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    /// Binary on PATH AND daemon answered a ping. Pipeline can continue.
    Ready,
    /// Binary on PATH but the daemon didn't respond — likely Docker Desktop
    /// is installed but not started.
    DaemonUnreachable,
    /// No `docker` binary on PATH. User must install Docker Desktop / Engine.
    NotInstalled,
}

#[derive(Debug, Serialize)]
pub struct Output {
    pub status: Status,
    /// Absolute path to the `docker` binary, if found on PATH.
    pub binary_path: Option<String>,
    /// Version string from `docker --version`, if the binary is callable.
    pub client_version: Option<String>,
    /// Server (daemon) version from the API, only present when `Ready`.
    pub server_version: Option<String>,
    /// One-line, user-facing remediation. Empty when `Ready`.
    pub hint: String,
}

pub fn manifest() -> ToolManifest {
    ToolManifest {
        name: NAME,
        description: DESCRIPTION,
        parameters: PARAMETERS,
    }
}

pub async fn run(_args: Args) -> Result<Output> {
    let binary_path = which_docker().await.map(|p| p.display().to_string());
    let client_version = if binary_path.is_some() {
        client_version().await
    } else {
        None
    };

    let Some(_) = binary_path.as_ref() else {
        return Ok(Output {
            status: Status::NotInstalled,
            binary_path: None,
            client_version: None,
            server_version: None,
            hint: install_hint(),
        });
    };

    // Binary exists; probe the daemon. We use a bollard ping with a short
    // timeout so a hung daemon doesn't stall the whole agent.
    match daemon_version().await {
        Some(server) => Ok(Output {
            status: Status::Ready,
            binary_path,
            client_version,
            server_version: Some(server),
            hint: String::new(),
        }),
        None => Ok(Output {
            status: Status::DaemonUnreachable,
            binary_path,
            client_version,
            server_version: None,
            hint: daemon_unreachable_hint(),
        }),
    }
}

async fn which_docker() -> Option<PathBuf> {
    // Use `which` on Unix / `where` on Windows. Tauri targets macOS+Linux first,
    // so `which` is the primary path.
    let cmd = if cfg!(windows) { "where" } else { "which" };
    let out = Command::new(cmd)
        .arg("docker")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let first = String::from_utf8_lossy(&out.stdout)
        .lines()
        .next()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())?;
    Some(PathBuf::from(first))
}

async fn client_version() -> Option<String> {
    let out = Command::new("docker")
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let raw = String::from_utf8_lossy(&out.stdout);
    let line = raw.lines().next()?.trim().to_string();
    if line.is_empty() { None } else { Some(line) }
}

async fn daemon_version() -> Option<String> {
    // Bound the probe so a wedged daemon doesn't hang the agent.
    let probe = async {
        let docker = docker::connect().ok()?;
        let v = docker.version().await.ok()?;
        v.version
    };
    tokio::time::timeout(std::time::Duration::from_secs(3), probe).await.ok().flatten()
}

fn install_hint() -> String {
    if cfg!(target_os = "macos") {
        "Docker isn't installed. Install Docker Desktop from \
         https://www.docker.com/products/docker-desktop/ and re-run the scan."
            .to_string()
    } else if cfg!(target_os = "linux") {
        "Docker isn't installed. Install Docker Engine via your distro's \
         package manager (e.g. `curl -fsSL https://get.docker.com | sh`) and \
         re-run the scan."
            .to_string()
    } else {
        "Docker isn't installed. Install Docker for your platform from \
         https://www.docker.com/get-started/ and re-run the scan."
            .to_string()
    }
}

fn daemon_unreachable_hint() -> String {
    if cfg!(target_os = "macos") {
        "Docker is installed but the daemon isn't responding. Start Docker \
         Desktop (open it from /Applications) and wait for the whale icon to \
         go solid, then re-run the scan."
            .to_string()
    } else {
        "Docker is installed but the daemon isn't responding. Start it with \
         `sudo systemctl start docker` (or your platform's equivalent) and \
         re-run the scan."
            .to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn args_parses_empty_object() {
        let _: Args = serde_json::from_str("{}").unwrap();
    }

    #[test]
    fn manifest_is_well_formed() {
        let m = manifest();
        assert_eq!(m.name, "check_docker");
        let v: serde_json::Value = serde_json::from_str(m.parameters).unwrap();
        assert_eq!(v["type"], "object");
    }

    #[test]
    fn install_hint_is_platform_specific_and_actionable() {
        let hint = install_hint();
        assert!(hint.contains("Docker"));
        // Hint must mention either an installer URL or a concrete command so
        // the user has something to act on.
        assert!(
            hint.contains("docker.com") || hint.contains("get.docker.com"),
            "install hint should include an install URL/command, got: {hint}"
        );
    }

    #[test]
    fn daemon_unreachable_hint_tells_user_to_start_docker() {
        let hint = daemon_unreachable_hint();
        assert!(hint.to_lowercase().contains("start"));
    }

    /// Live-Docker integration test — only runs when a daemon is reachable.
    #[tokio::test]
    #[ignore = "requires docker daemon"]
    async fn run_returns_ready_on_live_daemon() {
        let out = run(Args::default()).await.unwrap();
        assert_eq!(out.status, Status::Ready);
        assert!(out.binary_path.is_some());
        assert!(out.server_version.is_some());
        assert!(out.hint.is_empty());
    }
}
