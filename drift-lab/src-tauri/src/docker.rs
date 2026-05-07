//! Docker integration via `bollard`. Stubbed for now — the workflow currently
//! simulates each stage. These signatures are the contract the workflow will
//! call once stages are wired for real.

use anyhow::Result;
use bollard::Docker;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ImageInfo {
    pub id: String,
    pub repo_tag: String,
    pub size_bytes: u64,
}

pub fn connect() -> Result<Docker> {
    Ok(Docker::connect_with_local_defaults()?)
}

#[allow(dead_code)]
pub async fn find_image(_path: &str) -> Result<Option<ImageInfo>> {
    // TODO: parse Dockerfile / docker-compose.yml under `path`, resolve image tag.
    Ok(None)
}

#[allow(dead_code)]
pub async fn inspect_layers(_image: &str) -> Result<Vec<String>> {
    // TODO: docker.inspect_image, walk layers, sniff language/runtime.
    Ok(vec![])
}
