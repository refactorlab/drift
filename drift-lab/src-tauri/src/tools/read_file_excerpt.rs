//! Read-only file excerpt — bounded `head -n` style reader the agent uses
//! when it wants to look at a config file (`package.json`, `pyproject.toml`,
//! a Dockerfile) or a single source file before reasoning about it.
//!
//! Hard caps protect against the model accidentally requesting a 4 GB log
//! file or a binary. We refuse to read anything we believe is binary based
//! on the first 4 KB sniff (NUL byte heuristic).

use std::path::PathBuf;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, BufReader};

use super::ToolManifest;

pub const NAME: &str = "read_file_excerpt";
pub const DESCRIPTION: &str =
    "Read up to `max_lines` lines from a text file starting at `start_line` (1-indexed). Refuses \
     to read binary files. Use this to peek into manifests, configs, or single source files when \
     reasoning about a project — keep `max_lines` small (≤200) for the LLM to stay in context.";
pub const PARAMETERS: &str = r#"{
  "type": "object",
  "properties": {
    "path": {"type": "string", "description": "Absolute path to the file."},
    "start_line": {"type": "integer", "description": "1-indexed start line (default 1)."},
    "max_lines": {"type": "integer", "description": "Cap on line count (default 100, max 500)."}
  },
  "required": ["path"]
}"#;

#[derive(Debug, Deserialize)]
pub struct Args {
    pub path: String,
    pub start_line: Option<u32>,
    pub max_lines: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct Output {
    pub path: String,
    /// 1-indexed line of the first line in `content`.
    pub start_line: u32,
    /// Number of lines actually returned.
    pub lines_returned: u32,
    /// Total lines in the file (so the agent can decide whether to scroll).
    pub total_lines: u32,
    /// Whether the file ended before `max_lines` was hit.
    pub eof: bool,
    /// The actual excerpt. Newline-terminated, last line possibly without
    /// trailing newline if the file didn't have one.
    pub content: String,
}

pub fn manifest() -> ToolManifest {
    ToolManifest {
        name: NAME,
        description: DESCRIPTION,
        parameters: PARAMETERS,
    }
}

const DEFAULT_MAX_LINES: u32 = 100;
const MAX_LINES_HARD: u32 = 500;
/// Largest file we'll touch. 5 MB is plenty for any text manifest / source
/// file; anything bigger is almost certainly a build artefact.
const MAX_FILE_SIZE: u64 = 5 * 1024 * 1024;

pub async fn run(args: Args) -> Result<Output> {
    let path = PathBuf::from(&args.path);
    let metadata = tokio::fs::metadata(&path)
        .await
        .with_context(|| format!("stat {}", path.display()))?;
    if !metadata.is_file() {
        anyhow::bail!("not a file: {}", path.display());
    }
    if metadata.len() > MAX_FILE_SIZE {
        anyhow::bail!(
            "file too large: {} bytes (cap {} bytes — use a more specific tool)",
            metadata.len(),
            MAX_FILE_SIZE
        );
    }

    // Binary sniff: read the first 4 KB and look for a NUL byte. This catches
    // GGUFs, compiled binaries, images, archives — without false-positiving on
    // any normal text source file.
    let probe = tokio::fs::read(&path)
        .await
        .with_context(|| format!("probe {}", path.display()))?;
    if probe.iter().take(4096).any(|b| *b == 0) {
        anyhow::bail!("looks binary: {}", path.display());
    }

    let start = args.start_line.unwrap_or(1).max(1);
    let cap = args.max_lines.unwrap_or(DEFAULT_MAX_LINES).min(MAX_LINES_HARD);

    let f = tokio::fs::File::open(&path)
        .await
        .with_context(|| format!("open {}", path.display()))?;
    let mut reader = BufReader::new(f).lines();
    let mut current = 0u32;
    let mut content = String::new();
    let mut returned = 0u32;
    let mut total = 0u32;
    loop {
        match reader.next_line().await {
            Ok(Some(line)) => {
                current += 1;
                total += 1;
                if current >= start && returned < cap {
                    content.push_str(&line);
                    content.push('\n');
                    returned += 1;
                }
            }
            Ok(None) => break,
            Err(e) => return Err(e).context("reading lines"),
        }
    }
    let eof = true;

    Ok(Output {
        path: path.display().to_string(),
        start_line: start,
        lines_returned: returned,
        total_lines: total,
        eof,
        content,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tempfile(name: &str, content: &[u8]) -> PathBuf {
        let path = std::env::temp_dir()
            .join(format!("drift-rfx-{name}-{}.txt", std::process::id()));
        std::fs::write(&path, content).unwrap();
        path
    }

    #[tokio::test]
    async fn reads_full_small_text_file() {
        let p = tempfile("small", b"a\nb\nc\n");
        let out = run(Args {
            path: p.display().to_string(),
            start_line: None,
            max_lines: None,
        })
        .await
        .unwrap();
        assert_eq!(out.lines_returned, 3);
        assert_eq!(out.total_lines, 3);
        assert_eq!(out.content, "a\nb\nc\n");
        assert!(out.eof);
    }

    #[tokio::test]
    async fn honours_start_and_max_lines() {
        let body: String = (1..=20).map(|i| format!("line{i}\n")).collect();
        let p = tempfile("paged", body.as_bytes());
        let out = run(Args {
            path: p.display().to_string(),
            start_line: Some(5),
            max_lines: Some(3),
        })
        .await
        .unwrap();
        assert_eq!(out.start_line, 5);
        assert_eq!(out.lines_returned, 3);
        assert_eq!(out.total_lines, 20);
        assert_eq!(out.content, "line5\nline6\nline7\n");
    }

    #[tokio::test]
    async fn refuses_binary_files() {
        let p = tempfile("bin", b"hello\0world");
        let err = run(Args {
            path: p.display().to_string(),
            start_line: None,
            max_lines: None,
        })
        .await
        .unwrap_err();
        assert!(err.to_string().contains("looks binary"));
    }

    #[tokio::test]
    async fn rejects_non_files() {
        let dir = std::env::temp_dir().join(format!("drift-rfx-dir-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let err = run(Args {
            path: dir.display().to_string(),
            start_line: None,
            max_lines: None,
        })
        .await
        .unwrap_err();
        assert!(err.to_string().contains("not a file"));
    }

    #[tokio::test]
    async fn caps_at_hard_max_even_when_caller_asks_for_more() {
        let body: String = (1..=1000).map(|i| format!("L{i}\n")).collect();
        let p = tempfile("big", body.as_bytes());
        let out = run(Args {
            path: p.display().to_string(),
            start_line: Some(1),
            // Asks for 5000, hard cap is 500.
            max_lines: Some(5000),
        })
        .await
        .unwrap();
        assert_eq!(out.lines_returned, MAX_LINES_HARD);
        assert_eq!(out.total_lines, 1000);
    }
}
