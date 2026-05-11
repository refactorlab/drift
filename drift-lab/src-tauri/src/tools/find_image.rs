//! Stage 0 — locate the Docker image the user wants profiled.
//!
//! Resolution order:
//!   1. `docker-compose.yml` / `compose.yaml` — pick the first service with a
//!      named `image:` field, or the first service with a `build:` block.
//!   2. `Dockerfile` at the project root — image must be built; we report the
//!      build context and synthesise a tag of the form `drift-lab/<dirname>`.
//!   3. Otherwise return `None` so the caller can ask the user.

use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use super::ToolManifest;

pub const NAME: &str = "find_image";
pub const DESCRIPTION: &str =
    "Scan a project directory for a Dockerfile or docker-compose file and resolve which image \
     should be profiled. Returns the image reference plus where it came from.";
pub const PARAMETERS: &str = r#"{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Absolute path to the project directory to scan."
    }
  },
  "required": ["path"]
}"#;

#[derive(Debug, Deserialize)]
pub struct Args {
    pub path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Source {
    Compose,
    Dockerfile,
}

#[derive(Debug, Serialize)]
pub struct Output {
    /// Image reference suitable for `docker pull` / `docker run`.
    /// May be a "to-be-built" synthetic tag if only a Dockerfile was found.
    pub image_ref: String,
    /// `compose` or `dockerfile`.
    pub source: Source,
    /// Path of the manifest we resolved from.
    pub manifest_path: String,
    /// For compose: which service we picked. For Dockerfile: `None`.
    pub compose_service: Option<String>,
    /// Build context relative to the project root, if the image needs building.
    pub build_context: Option<String>,
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
        anyhow::bail!("project path is not a directory: {}", root.display());
    }

    if let Some(out) = try_compose(&root)? {
        return Ok(out);
    }
    if let Some(out) = try_dockerfile(&root)? {
        return Ok(out);
    }
    anyhow::bail!(
        "no Dockerfile or compose manifest found under {}",
        root.display()
    )
}

fn try_compose(root: &Path) -> Result<Option<Output>> {
    for name in ["docker-compose.yml", "docker-compose.yaml", "compose.yaml", "compose.yml"] {
        let candidate = root.join(name);
        if !candidate.is_file() {
            continue;
        }
        let raw = std::fs::read_to_string(&candidate)
            .with_context(|| format!("read {}", candidate.display()))?;
        let services = parse_compose(&raw);
        let Some(svc) = pick_service(&services, root) else {
            continue;
        };
        // When the service builds from a local Dockerfile, that's the user's
        // own code — synthesise a `drift-lab/<dirname>-<service>` tag so we
        // don't accidentally report a third-party `image:` pull.
        let image_ref = match (&svc.image, &svc.build_ctx) {
            (_, Some(_)) => synthetic_tag_for_service(root, &svc.name),
            (Some(img), None) => img.clone(),
            (None, None) => synthetic_tag_for_service(root, &svc.name),
        };
        return Ok(Some(Output {
            image_ref,
            source: Source::Compose,
            manifest_path: candidate.display().to_string(),
            compose_service: Some(svc.name.clone()),
            build_context: svc.build_ctx.clone(),
        }));
    }
    Ok(None)
}

/// One parsed entry from `services:`. We carry image + build_ctx side by side
/// so the picker can score each service independently.
#[derive(Debug, Clone, PartialEq)]
struct ServiceDecl {
    name: String,
    image: Option<String>,
    build_ctx: Option<String>,
}

/// Pick the service that most likely represents the user's app. Scoring:
///
/// - **+100** has a `build:` block — that's the user's code, not a pulled dep.
/// - **+50** name matches / contains the project dirname.
/// - **+10** name contains an "app-like" hint (api/app/web/server/service/backend).
/// - **-20** image is a pulled-from-registry tag and there's no build block —
///   strong signal it's a dependency (databases, caches, queues).
///
/// Ties broken by document order. Returns `None` only when the compose file
/// has zero services.
fn pick_service<'a>(services: &'a [ServiceDecl], root: &Path) -> Option<&'a ServiceDecl> {
    if services.is_empty() {
        return None;
    }
    let dir_name = root
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mut best: Option<(i32, usize, &ServiceDecl)> = None;
    for (idx, svc) in services.iter().enumerate() {
        let mut score: i32 = 0;
        if svc.build_ctx.is_some() {
            score += 100;
        }
        if !dir_name.is_empty()
            && (dir_name.contains(&svc.name.to_lowercase())
                || svc.name.to_lowercase().contains(&dir_name))
        {
            score += 50;
        }
        let lc = svc.name.to_lowercase();
        for hint in ["api", "app", "web", "server", "service", "backend"] {
            if lc.contains(hint) {
                score += 10;
                break;
            }
        }
        if svc.image.is_some() && svc.build_ctx.is_none() {
            score -= 20;
        }
        let better = match best {
            None => true,
            // Higher score wins; ties go to earlier document position.
            Some((s, i, _)) => score > s || (score == s && idx < i),
        };
        if better {
            best = Some((score, idx, svc));
        }
    }
    best.map(|(_, _, s)| s)
}

fn synthetic_tag_for_service(root: &Path, service: &str) -> String {
    let dir = root
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("project")
        .to_lowercase();
    format!("drift-lab/{dir}-{service}:latest")
}

fn try_dockerfile(root: &Path) -> Result<Option<Output>> {
    let dockerfile = root.join("Dockerfile");
    if !dockerfile.is_file() {
        return Ok(None);
    }
    Ok(Some(Output {
        image_ref: synthetic_tag(root),
        source: Source::Dockerfile,
        manifest_path: dockerfile.display().to_string(),
        compose_service: None,
        build_context: Some(".".to_string()),
    }))
}

/// Tiny line-based compose parser — pulls out every service block with its
/// `image:` and `build:` context. We deliberately avoid a full YAML dependency
/// here; this is a heuristic, not a validator. It works on the 95% of compose
/// files written in plain 2-space-indent style.
fn parse_compose(raw: &str) -> Vec<ServiceDecl> {
    let mut services: Vec<ServiceDecl> = Vec::new();
    let mut in_services = false;
    let mut current: Option<ServiceDecl> = None;
    let mut in_build_block = false;

    for line in raw.lines() {
        let trimmed = line.trim_end();
        if trimmed.is_empty() || trimmed.trim_start().starts_with('#') {
            continue;
        }
        let indent = trimmed.len() - trimmed.trim_start().len();

        if indent == 0 {
            if let Some(svc) = current.take() {
                services.push(svc);
            }
            in_services = trimmed.starts_with("services:");
            in_build_block = false;
            continue;
        }
        if !in_services {
            continue;
        }

        // Service name lines look like `  myservice:` at indent 2.
        if indent == 2 && trimmed.trim_end().ends_with(':') {
            if let Some(svc) = current.take() {
                services.push(svc);
            }
            let name = trimmed.trim().trim_end_matches(':').to_string();
            current = Some(ServiceDecl {
                name,
                image: None,
                build_ctx: None,
            });
            in_build_block = false;
            continue;
        }

        let Some(svc) = current.as_mut() else { continue };
        let body = trimmed.trim_start();
        // Per-service keys at indent 4.
        if indent == 4 {
            in_build_block = false;
            if let Some(rest) = body.strip_prefix("image:") {
                svc.image = Some(rest.trim().trim_matches('"').trim_matches('\'').to_string());
            } else if let Some(rest) = body.strip_prefix("build:") {
                let val = rest.trim();
                if val.is_empty() {
                    in_build_block = true;
                } else {
                    svc.build_ctx = Some(val.trim_matches('"').trim_matches('\'').to_string());
                }
            }
        } else if indent == 6 && in_build_block {
            // `build:\n      context: .` — only honour context inside a build block.
            if let Some(rest) = body.strip_prefix("context:") {
                svc.build_ctx = Some(rest.trim().trim_matches('"').trim_matches('\'').to_string());
            }
        }
    }
    if let Some(svc) = current.take() {
        services.push(svc);
    }
    services
}

fn synthetic_tag(root: &Path) -> String {
    let name = root
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("project")
        .to_lowercase();
    format!("drift-lab/{name}:latest")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tempdir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("drift-lab-find-{}-{}", name, std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn parses_compose_with_image() {
        let raw = "services:\n  api:\n    image: my/api:1.2\n    ports:\n      - \"8080:80\"\n";
        let services = parse_compose(raw);
        assert_eq!(services.len(), 1);
        assert_eq!(services[0].name, "api");
        assert_eq!(services[0].image.as_deref(), Some("my/api:1.2"));
        assert!(services[0].build_ctx.is_none());
    }

    #[test]
    fn parses_compose_with_build_context() {
        let raw = "services:\n  worker:\n    build:\n      context: ./worker\n";
        let services = parse_compose(raw);
        assert_eq!(services.len(), 1);
        assert_eq!(services[0].name, "worker");
        assert!(services[0].image.is_none());
        assert_eq!(services[0].build_ctx.as_deref(), Some("./worker"));
    }

    #[test]
    fn parse_compose_skips_comments_and_blanks() {
        let raw = "# top-level comment\nservices:\n\n  api:\n    # service comment\n    image: \"foo:1\"\n";
        let services = parse_compose(raw);
        assert_eq!(services.len(), 1);
        assert_eq!(services[0].name, "api");
        assert_eq!(services[0].image.as_deref(), Some("foo:1"));
    }

    #[test]
    fn parse_compose_returns_every_service_in_order() {
        // Real-world: a deps-first compose with redis followed by the actual
        // app service that builds locally. The parser used to skip everything
        // past the first service.
        let raw = "services:\n  redis:\n    image: valkey/valkey:8.0-alpine\n  api:\n    build:\n      context: .\n      dockerfile: Dockerfile\n";
        let services = parse_compose(raw);
        assert_eq!(services.len(), 2);
        assert_eq!(services[0].name, "redis");
        assert_eq!(services[0].image.as_deref(), Some("valkey/valkey:8.0-alpine"));
        assert!(services[0].build_ctx.is_none());
        assert_eq!(services[1].name, "api");
        assert!(services[1].image.is_none());
        assert_eq!(services[1].build_ctx.as_deref(), Some("."));
    }

    #[test]
    fn pick_service_prefers_build_over_pulled_image() {
        let services = vec![
            ServiceDecl {
                name: "redis".into(),
                image: Some("valkey/valkey:8.0-alpine".into()),
                build_ctx: None,
            },
            ServiceDecl {
                name: "api".into(),
                image: None,
                build_ctx: Some(".".into()),
            },
        ];
        let root = std::path::Path::new("/tmp/automation-enrichements");
        let picked = pick_service(&services, root).unwrap();
        assert_eq!(picked.name, "api");
    }

    #[test]
    fn pick_service_prefers_name_matching_dirname() {
        let services = vec![
            ServiceDecl {
                name: "postgres".into(),
                image: Some("postgres:15".into()),
                build_ctx: None,
            },
            ServiceDecl {
                name: "checkout".into(),
                image: Some("internal/checkout:dev".into()),
                build_ctx: None,
            },
        ];
        let root = std::path::Path::new("/srv/checkout-service");
        let picked = pick_service(&services, root).unwrap();
        assert_eq!(picked.name, "checkout");
    }

    #[test]
    fn synthetic_tag_lowercases_dirname() {
        let path = std::path::Path::new("/tmp/Checkout-Service");
        assert_eq!(synthetic_tag(path), "drift-lab/checkout-service:latest");
    }

    #[test]
    fn synthetic_tag_for_service_appends_service_name() {
        let path = std::path::Path::new("/tmp/Checkout-Service");
        assert_eq!(
            synthetic_tag_for_service(path, "api"),
            "drift-lab/checkout-service-api:latest"
        );
    }

    #[tokio::test]
    async fn run_returns_compose_output_when_compose_present() {
        let dir = tempdir("compose");
        std::fs::write(
            dir.join("docker-compose.yml"),
            "services:\n  api:\n    image: registry/svc:42\n",
        )
        .unwrap();

        let out = run(Args { path: dir.display().to_string() }).await.unwrap();
        assert!(matches!(out.source, Source::Compose));
        assert_eq!(out.image_ref, "registry/svc:42");
        assert_eq!(out.compose_service.as_deref(), Some("api"));
    }

    #[tokio::test]
    async fn run_skips_third_party_service_and_picks_build_service() {
        // Regression: this is the exact compose shape from
        // /Users/ilyas/Projects/cf-mono/workspaces/automation-enrichements.
        // The old parser picked `redis` (valkey/valkey:8.0-alpine) — the wrong
        // image. We now must pick `api` because it has a `build:` block.
        let dir = tempdir("api-plus-deps");
        std::fs::write(
            dir.join("docker-compose.yml"),
            r#"services:
  redis:
    image: valkey/valkey:8.0-alpine
    ports:
      - "6379:6379"
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
"#,
        )
        .unwrap();

        let out = run(Args { path: dir.display().to_string() }).await.unwrap();
        assert!(matches!(out.source, Source::Compose));
        assert_eq!(out.compose_service.as_deref(), Some("api"));
        // image_ref must reflect "we'll build it", not the unrelated valkey tag.
        assert!(
            !out.image_ref.contains("valkey"),
            "image_ref must not pick up the unrelated dependency image, got {}",
            out.image_ref
        );
        assert!(
            out.image_ref.starts_with("drift-lab/"),
            "expected synthetic build tag, got {}",
            out.image_ref
        );
        assert_eq!(out.build_context.as_deref(), Some("."));
    }

    #[tokio::test]
    async fn run_falls_back_to_dockerfile_with_synthetic_tag() {
        let dir = tempdir("docker");
        std::fs::write(dir.join("Dockerfile"), "FROM python:3.11\n").unwrap();

        let out = run(Args { path: dir.display().to_string() }).await.unwrap();
        assert!(matches!(out.source, Source::Dockerfile));
        assert!(out.image_ref.starts_with("drift-lab/"));
        assert_eq!(out.build_context.as_deref(), Some("."));
        assert!(out.compose_service.is_none());
    }

    #[tokio::test]
    async fn run_errors_when_nothing_found() {
        let dir = tempdir("empty");
        let err = run(Args { path: dir.display().to_string() }).await.unwrap_err();
        assert!(err.to_string().contains("no Dockerfile or compose"));
    }

    #[tokio::test]
    async fn run_errors_when_path_is_not_a_dir() {
        let err = run(Args { path: "/definitely/not/a/dir/zzz".into() })
            .await
            .unwrap_err();
        assert!(err.to_string().contains("not a directory"));
    }
}
