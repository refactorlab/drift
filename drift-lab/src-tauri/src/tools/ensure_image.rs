//! Stage 0.5 — make sure the image `find_image` picked actually exists on the
//! local Docker daemon before any later stage tries to `docker inspect` it.
//!
//! Real-world failure mode this fixes: `find_image` reads a compose file at
//! `…/automation-enrichements` and picks the `api` service (build context),
//! producing a synthetic tag like `drift-lab/automation-enrichements-api:latest`.
//! That image hasn't been built yet, so `detect_runtime` returns the cryptic
//! `Docker responded with status code 404: No such image`. Mirror failure for
//! pulled-from-registry services like `valkey/valkey:8.0-alpine` that the user
//! hasn't pulled yet.
//!
//! Decision tree once we know the image is missing:
//!   - have a `build_context` → run `docker compose build <service>` against
//!     the compose manifest (preserves multi-service args/networks/dependencies);
//!     fall back to `docker build -t <image> <ctx>` for a bare Dockerfile.
//!   - no `build_context` → it's a registry image the user expected pulled →
//!     run `docker pull <image>` and let the daemon resolve it.
//!
//! Always shells out to the `docker` CLI rather than driving the bollard build
//! API directly. The CLI handles BuildKit, compose, .dockerignore, and remote
//! contexts uniformly; rebuilding that in-process is a much bigger surface than
//! the value we'd gain.

use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

use anyhow::{Context, Result};
use bollard::image::ListImagesOptions;
use serde::{Deserialize, Serialize};
use tokio::process::Command;

use super::ToolManifest;
use crate::docker;

pub const NAME: &str = "ensure_image";
pub const DESCRIPTION: &str =
    "Verify a Docker image exists on the local daemon. If it doesn't, build it from the supplied \
     Dockerfile/compose context, or pull it if no build context is available. Call this between \
     `find_image` and `detect_runtime`. Inputs come straight from `find_image`'s output.";
pub const PARAMETERS: &str = r#"{
  "type": "object",
  "properties": {
    "image": {
      "type": "string",
      "description": "Image reference to ensure exists (e.g. the `image_ref` field from `find_image`)."
    },
    "build_context": {
      "type": "string",
      "description": "Build context path (the `build_context` field from `find_image`). Relative paths resolve against `project_path`. Omit for registry-only images."
    },
    "project_path": {
      "type": "string",
      "description": "Absolute path of the project — used as the working dir for `docker build` / `docker compose build`. Required when build_context is set."
    },
    "manifest_path": {
      "type": "string",
      "description": "Optional absolute path to the compose manifest if `find_image` came from one. When provided we run `docker compose -f <manifest_path> build <service>` to pick up multi-service args."
    },
    "compose_service": {
      "type": "string",
      "description": "Compose service name when `manifest_path` points at a compose file. Required to scope the build to one service."
    }
  },
  "required": ["image"]
}"#;

#[derive(Debug, Deserialize)]
pub struct Args {
    pub image: String,
    pub build_context: Option<String>,
    pub project_path: Option<String>,
    pub manifest_path: Option<String>,
    pub compose_service: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    /// Image was already on the daemon. No build / pull needed.
    AlreadyPresent,
    /// The exact ref wasn't on the daemon, but we found another locally-built
    /// image that matches the project (e.g. user ran `make docker-build`
    /// earlier and got `automation-enrichements:latest`). The caller should
    /// use `resolved_image` for the next step.
    DiscoveredExisting,
    /// We ran `docker (compose) build` and the image is now available.
    Built,
    /// We ran `docker pull` and the image is now available.
    Pulled,
    /// Couldn't materialise the image — `error` carries the underlying message.
    Failed,
}

#[derive(Debug, Serialize)]
pub struct Output {
    pub status: Status,
    /// The image ref that's actually usable now — `find_image`'s original ref
    /// when we built/pulled, or the discovered locally-built tag when we
    /// found one. `detect_runtime` should call `docker inspect` on this.
    pub resolved_image: String,
    /// Original image ref the caller passed in. Kept so the agent can compare
    /// "what I asked for" vs "what I got" in its summary.
    pub requested_image: String,
    /// `inspect`, `discovered`, `compose-build`, `dockerfile-build`, or `pull`.
    /// Useful when the agent wants to explain *how* the image got there.
    pub strategy: &'static str,
    /// Stderr+stdout from the build / pull command, truncated. Empty when the
    /// image was already present.
    pub build_log: String,
    /// Human-readable error when `status == Failed`. Empty otherwise.
    pub error: String,
}

pub fn manifest() -> ToolManifest {
    ToolManifest {
        name: NAME,
        description: DESCRIPTION,
        parameters: PARAMETERS,
    }
}

/// Cap on the build/pull command. Long enough for cold first builds (`bun
/// install` of a real repo can run 60-90s); short enough that a wedged build
/// doesn't pin the agent indefinitely.
const COMMAND_TIMEOUT: Duration = Duration::from_secs(600);

pub async fn run(args: Args) -> Result<Output> {
    let requested = args.image.clone();

    // [1] Fast path: the exact requested ref is on the daemon.
    if image_exists(&requested).await {
        return Ok(Output {
            status: Status::AlreadyPresent,
            resolved_image: requested.clone(),
            requested_image: requested,
            strategy: "inspect",
            build_log: String::new(),
            error: String::new(),
        });
    }

    // [2] Project-aware discovery. The synthetic tag `find_image` generates
    // (`drift-lab/<dir>-<svc>:latest`) rarely matches what the user actually
    // built — Makefiles tag as `<dir>:latest`, `docker compose build` tags as
    // `<dir>-<svc>:latest` (no `drift-lab/` prefix). Scan the daemon's image
    // list for any tag related to this project before deciding to build.
    if let Some(project_dir) = project_dir_name(&args) {
        if let Some(discovered) = discover_existing_image(&project_dir, args.compose_service.as_deref()).await {
            return Ok(Output {
                status: Status::DiscoveredExisting,
                resolved_image: discovered,
                requested_image: requested,
                strategy: "discovered",
                build_log: String::new(),
                error: String::new(),
            });
        }
    }

    // [3] Decide: build or pull?
    if let Some(ctx) = args.build_context.as_deref().filter(|s| !s.is_empty()) {
        // Anchor the build on the project root so relative `context: .` works
        // exactly like the user typing `docker compose build` themselves.
        let workdir = args
            .project_path
            .as_deref()
            .filter(|s| !s.is_empty())
            .unwrap_or(ctx);

        // Prefer `docker compose build <service>` when we have a compose
        // manifest — that path honours service-level args, networks, and
        // depends_on which a bare `docker build` doesn't.
        if let (Some(manifest), Some(service)) =
            (args.manifest_path.as_deref(), args.compose_service.as_deref())
        {
            return build_with_compose(&requested, manifest, service, workdir).await;
        }

        // Bare Dockerfile fallback.
        return build_with_dockerfile(&requested, ctx, workdir).await;
    }

    // [4] No build context — it's a registry image the user expected to be pulled.
    pull_image(&requested).await
}

/// Extract the project's directory name from `project_path`, or fall back to
/// the build_context if absolute. Used as the substring we look for in image
/// tags during existing-image discovery. Lowercased to match the daemon's
/// normalisation.
fn project_dir_name(args: &Args) -> Option<String> {
    let path = args
        .project_path
        .as_deref()
        .or(args.build_context.as_deref())?;
    let name = Path::new(path).file_name()?.to_str()?;
    Some(name.to_lowercase())
}

/// Search the local daemon for any image whose repo tag relates to this
/// project. Ranking (best first):
///   1. exact match against `<dir>-<service>:latest` (compose v2 default tag)
///   2. exact match against `<dir>_<service>:latest` (compose v1 default tag)
///   3. exact match against `<dir>:latest` (typical `make docker-build` tag)
///   4. any other tag whose repository name contains the dir or service
///      substring
///
/// We list ALL local images once and score them in memory — that's cheaper
/// than a chain of `docker inspect` calls and lets us pick the *best* match
/// rather than the first.
async fn discover_existing_image(project_dir: &str, service: Option<&str>) -> Option<String> {
    let docker = docker::connect().ok()?;
    let images = docker
        .list_images(Some(ListImagesOptions::<String> {
            all: false,
            ..Default::default()
        }))
        .await
        .ok()?;

    let compose_v2 = service.map(|s| format!("{project_dir}-{s}"));
    let compose_v1 = service.map(|s| format!("{project_dir}_{s}"));

    let mut best: Option<(i32, String)> = None;
    for img in &images {
        for tag in img.repo_tags.iter() {
            // Strip the `:latest` (or any tag) for repo-name comparisons.
            let repo = tag.split(':').next().unwrap_or(tag).to_lowercase();
            let score: i32 = if Some(&repo) == compose_v2.as_ref() {
                400
            } else if Some(&repo) == compose_v1.as_ref() {
                300
            } else if repo == project_dir {
                200
            } else if service.is_some_and(|s| repo.contains(s) && repo.contains(project_dir)) {
                100
            } else if repo.contains(project_dir) {
                50
            } else {
                continue;
            };
            // Prefer `:latest` over arbitrary digests when scores tie.
            let bonus = if tag.ends_with(":latest") { 5 } else { 0 };
            let total = score + bonus;
            match &best {
                Some((s, _)) if *s >= total => {}
                _ => best = Some((total, tag.clone())),
            }
        }
    }
    best.map(|(_, tag)| tag)
}

async fn image_exists(image: &str) -> bool {
    // Use bollard's inspect — that's exactly what `detect_runtime` will call
    // afterwards, so a positive answer here guarantees the next step succeeds.
    let Ok(docker) = docker::connect() else { return false };
    docker.inspect_image(image).await.is_ok()
}

async fn build_with_compose(
    image: &str,
    manifest: &str,
    service: &str,
    workdir: &str,
) -> Result<Output> {
    // `docker compose build` (v2 CLI) is what we want; fall back to legacy
    // `docker-compose build` if the user has only the old binary on PATH.
    let log = match run_logged(
        "docker",
        &["compose", "-f", manifest, "build", service],
        workdir,
    )
    .await
    {
        Ok(log) => log,
        Err(first_err) => match run_logged(
            "docker-compose",
            &["-f", manifest, "build", service],
            workdir,
        )
        .await
        {
            Ok(log) => log,
            Err(_) => {
                return Ok(Output {
                    status: Status::Failed,
                    resolved_image: image.to_string(),
                    requested_image: image.to_string(),
                    strategy: "compose-build",
                    build_log: String::new(),
                    error: format!("docker compose build failed: {first_err}"),
                });
            }
        },
    };

    if image_exists(image).await {
        return Ok(Output {
            status: Status::Built,
            resolved_image: image.to_string(),
            requested_image: image.to_string(),
            strategy: "compose-build",
            build_log: log,
            error: String::new(),
        });
    }
    // Compose succeeded but the requested tag isn't on the daemon — compose
    // tagged it under its own convention. Search for the resulting tag so we
    // can hand the caller a usable ref instead of bailing.
    let project_dir = project_dir_name_from_workdir(workdir);
    if let Some(dir) = project_dir.as_deref() {
        if let Some(found) = discover_existing_image(dir, Some(service)).await {
            return Ok(Output {
                status: Status::Built,
                resolved_image: found,
                requested_image: image.to_string(),
                strategy: "compose-build",
                build_log: log,
                error: String::new(),
            });
        }
    }
    Ok(Output {
        status: Status::Failed,
        resolved_image: image.to_string(),
        requested_image: image.to_string(),
        strategy: "compose-build",
        build_log: log,
        error: format!(
            "compose build completed but no image tagged `{image}` (or compose default \
             `<project>-{service}`) is on the daemon — check `docker images`"
        ),
    })
}

/// `workdir` is the absolute project path we ran compose from; pull the
/// basename so the post-build discovery can match against the same convention
/// as the initial scan.
fn project_dir_name_from_workdir(workdir: &str) -> Option<String> {
    Path::new(workdir)
        .file_name()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
}

async fn build_with_dockerfile(image: &str, ctx: &str, workdir: &str) -> Result<Output> {
    let log = run_logged("docker", &["build", "-t", image, ctx], workdir)
        .await
        .map_err(|e| anyhow::anyhow!("docker build failed: {e}"))?;
    if image_exists(image).await {
        Ok(Output {
            status: Status::Built,
            resolved_image: image.to_string(),
            requested_image: image.to_string(),
            strategy: "dockerfile-build",
            build_log: log,
            error: String::new(),
        })
    } else {
        Ok(Output {
            status: Status::Failed,
            resolved_image: image.to_string(),
            requested_image: image.to_string(),
            strategy: "dockerfile-build",
            build_log: log,
            error: format!(
                "docker build completed but `{image}` still isn't on the daemon"
            ),
        })
    }
}

async fn pull_image(image: &str) -> Result<Output> {
    match run_logged("docker", &["pull", image], "").await {
        Ok(log) => Ok(Output {
            status: Status::Pulled,
            resolved_image: image.to_string(),
            requested_image: image.to_string(),
            strategy: "pull",
            build_log: log,
            error: String::new(),
        }),
        Err(e) => Ok(Output {
            status: Status::Failed,
            resolved_image: image.to_string(),
            requested_image: image.to_string(),
            strategy: "pull",
            build_log: String::new(),
            error: format!("docker pull failed: {e}"),
        }),
    }
}

/// Spawn `cmd args...` in `workdir`, capture stdout+stderr (combined), apply
/// the global timeout, and return the captured log on success or an error
/// containing the same log on failure.
async fn run_logged(cmd: &str, args: &[&str], workdir: &str) -> Result<String> {
    let mut command = Command::new(cmd);
    command
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if !workdir.is_empty() {
        command.current_dir(workdir);
    }

    let output = tokio::time::timeout(COMMAND_TIMEOUT, command.output())
        .await
        .with_context(|| format!("`{cmd} {}` timed out after {:?}", args.join(" "), COMMAND_TIMEOUT))?
        .with_context(|| format!("spawn `{cmd}` failed"))?;

    let mut combined = String::new();
    combined.push_str(&String::from_utf8_lossy(&output.stdout));
    if !output.stderr.is_empty() {
        if !combined.ends_with('\n') {
            combined.push('\n');
        }
        combined.push_str(&String::from_utf8_lossy(&output.stderr));
    }
    let truncated = truncate(&combined, 8 * 1024);

    if output.status.success() {
        Ok(truncated)
    } else {
        let code = output.status.code().unwrap_or(-1);
        anyhow::bail!(
            "`{cmd} {}` exited with code {code}\n{truncated}",
            args.join(" "),
        )
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    let cut = s.char_indices().nth(max).map(|(i, _)| i).unwrap_or(max);
    format!("{}…(+{} chars truncated)", &s[..cut], s.len() - cut)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_is_well_formed() {
        let m = manifest();
        assert_eq!(m.name, "ensure_image");
        let v: serde_json::Value = serde_json::from_str(m.parameters).unwrap();
        assert_eq!(v["type"], "object");
        // Image is the only required field — the agent should be able to call
        // this for a registry pull with just the ref.
        assert_eq!(v["required"], serde_json::json!(["image"]));
    }

    #[test]
    fn args_parse_with_only_image() {
        let args: Args = serde_json::from_str(r#"{"image":"redis:7"}"#).unwrap();
        assert_eq!(args.image, "redis:7");
        assert!(args.build_context.is_none());
        assert!(args.project_path.is_none());
        assert!(args.manifest_path.is_none());
        assert!(args.compose_service.is_none());
    }

    #[test]
    fn args_parse_full_compose_shape() {
        let payload = r#"{
          "image":"drift-lab/x-api:latest",
          "build_context":".",
          "project_path":"/srv/x",
          "manifest_path":"/srv/x/docker-compose.yml",
          "compose_service":"api"
        }"#;
        let args: Args = serde_json::from_str(payload).unwrap();
        assert_eq!(args.build_context.as_deref(), Some("."));
        assert_eq!(args.compose_service.as_deref(), Some("api"));
    }

    #[test]
    fn truncate_caps_long_logs() {
        let s = "x".repeat(20_000);
        let out = truncate(&s, 1024);
        assert!(out.len() < s.len());
        assert!(out.contains("truncated"));
    }

    #[test]
    fn truncate_leaves_short_logs_alone() {
        let out = truncate("hello", 1024);
        assert_eq!(out, "hello");
    }

    #[test]
    fn project_dir_name_falls_back_to_build_context() {
        // When the agent forgot to pass `project_path`, we still want to
        // extract a project name from `build_context` (when absolute).
        let args = Args {
            image: "x:1".into(),
            build_context: Some("/srv/automation-enrichements".into()),
            project_path: None,
            manifest_path: None,
            compose_service: None,
        };
        assert_eq!(project_dir_name(&args).as_deref(), Some("automation-enrichements"));
    }

    #[test]
    fn project_dir_name_prefers_project_path() {
        let args = Args {
            image: "x:1".into(),
            build_context: Some(".".into()),
            project_path: Some("/srv/Checkout-Service".into()),
            manifest_path: None,
            compose_service: None,
        };
        // Lowercased to match daemon normalisation.
        assert_eq!(project_dir_name(&args).as_deref(), Some("checkout-service"));
    }

    #[test]
    fn project_dir_name_returns_none_with_no_inputs() {
        let args = Args {
            image: "x:1".into(),
            build_context: None,
            project_path: None,
            manifest_path: None,
            compose_service: None,
        };
        assert!(project_dir_name(&args).is_none());
    }

    /// Live test — verifies the project-aware discovery path against any
    /// locally-built image. We synthesise a non-existent ref but pass a
    /// project_path whose dirname matches a real image (`automation-
    /// enrichements`) — discovery should pick it up. Skipped when no
    /// matching image exists.
    #[tokio::test]
    #[ignore = "requires docker daemon + a project-named image"]
    async fn discovery_finds_locally_built_image_by_project_dirname() {
        // The dev box has `automation-enrichements:latest` built via `make
        // docker-build`; this test exercises the user-reported regression
        // where find_image's synthetic tag missed that image entirely.
        let synthetic = "drift-lab/automation-enrichements-api:does-not-exist";
        let out = run(Args {
            image: synthetic.to_string(),
            build_context: Some(".".into()),
            project_path: Some("/Users/ilyas/Projects/cf-mono/workspaces/automation-enrichements".into()),
            manifest_path: None,
            compose_service: Some("api".into()),
        })
        .await
        .unwrap();

        match out.status {
            Status::DiscoveredExisting => {
                assert_ne!(out.resolved_image, synthetic);
                assert!(
                    out.resolved_image.to_lowercase().contains("automation-enrichements"),
                    "expected discovered image to contain project dirname, got: {}",
                    out.resolved_image
                );
                assert_eq!(out.requested_image, synthetic);
            }
            Status::AlreadyPresent => {
                // Daemon happened to have the synthetic tag too — vacuously OK.
            }
            other => panic!(
                "expected DiscoveredExisting (or AlreadyPresent), got {other:?} with error={}",
                out.error
            ),
        }
    }

    /// Live test — only runs against a daemon that has *some* canonical small
    /// image. We don't pin a specific image because CI environments differ;
    /// the assertion is just that the function reports a sane shape.
    #[tokio::test]
    #[ignore = "requires docker daemon"]
    async fn already_present_short_circuits_on_known_image() {
        // Try a few low-cost images — whichever exists on this machine wins.
        for img in ["hello-world:latest", "alpine:latest", "busybox:latest"] {
            if image_exists(img).await {
                let out = run(Args {
                    image: img.to_string(),
                    build_context: None,
                    project_path: None,
                    manifest_path: None,
                    compose_service: None,
                })
                .await
                .unwrap();
                assert_eq!(out.status, Status::AlreadyPresent);
                assert_eq!(out.strategy, "inspect");
                assert_eq!(out.resolved_image, img);
                return;
            }
        }
        // No suitable image available — skip rather than fail.
        eprintln!("no local image found to exercise already_present path; skipping");
    }
}
