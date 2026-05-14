//! Tauri commands for the patch pipeline.
//!
//! `start_patch` streams a structured suggested-fix from the LLM over a
//! per-invocation `Channel<PatchEvent>`. `apply_patch` writes the parsed
//! sections back to disk by synthesizing a one-hunk unified diff and
//! handing it to `udiffx::apply_file_changes`.

use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result};
use futures_util::StreamExt;
use tauri::{ipc::Channel, AppHandle, Runtime, State};

use crate::agent::provider::Provider;
use crate::agent::types::{Message, MessageContent, Role};
use crate::agent::OpenAiProvider;
use crate::model_config::ModelBackend;
use crate::patch::types::{ApplyArgs, ApplyItem, ApplyResult, PatchEvent};
use crate::state::AppState;

const CONTEXT_RADIUS: usize = 60;

#[tauri::command]
pub async fn start_patch<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, AppState>,
    file: String,
    line: usize,
    prompt: String,
    channel: Channel<PatchEvent>,
) -> std::result::Result<(), String> {
    let config = state
        .config
        .lock()
        .await
        .clone()
        .ok_or_else(|| "backend not configured".to_string())?;
    let provider = build_provider(config).map_err(|e| format!("{e:#}"))?;
    let request_id = uuid::Uuid::new_v4().to_string();

    tauri::async_runtime::spawn(async move {
        let _ = channel.send(PatchEvent::Started {
            request_id: request_id.clone(),
        });
        match run_stream(provider, &file, line, &prompt, &channel).await {
            Ok(full) => {
                let _ = channel.send(PatchEvent::Done { full_text: full });
            }
            Err(e) => {
                let _ = channel.send(PatchEvent::Error {
                    message: format!("{e:#}"),
                });
            }
        }
    });
    Ok(())
}

async fn run_stream(
    provider: Arc<dyn Provider>,
    file: &str,
    line: usize,
    prompt: &str,
    channel: &Channel<PatchEvent>,
) -> Result<String> {
    let abs = PathBuf::from(file);
    let body = tokio::fs::read_to_string(&abs)
        .await
        .with_context(|| format!("read {file}"))?;
    let (start, end, slice) = window_around(&body, line, CONTEXT_RADIUS);

    let system = SYSTEM_PROMPT.to_string();
    let user = build_user_prompt(file, line, start, end, &slice, prompt);
    let messages = vec![Message {
        role: Role::User,
        content: vec![MessageContent::text(user)],
    }];

    let mut stream = provider
        .stream(&system, &messages, &[])
        .await
        .context("opening provider stream")?;

    let mut full = String::new();
    while let Some(next) = stream.next().await {
        let (msg, _usage) = next.context("provider stream item")?;
        if let Some(m) = msg {
            let chunk = m.flat_text();
            if chunk.is_empty() {
                continue;
            }
            full.push_str(&chunk);
            let _ = channel.send(PatchEvent::Delta { text: chunk });
        }
    }
    Ok(full)
}

/// Take a 1-based line window around `anchor`, clamped to the file's bounds.
/// Returns (start_1based, end_1based, joined_text).
fn window_around(body: &str, anchor: usize, radius: usize) -> (usize, usize, String) {
    let lines: Vec<&str> = body.lines().collect();
    let total = lines.len();
    let anchor = anchor.max(1).min(total.max(1));
    let start = anchor.saturating_sub(radius).max(1);
    let end = (anchor + radius).min(total);
    let slice = lines[(start - 1)..end].join("\n");
    (start, end, slice)
}

const SYSTEM_PROMPT: &str = "You are a precise code editor. \
Given a source window and a user request, emit EXACTLY this structure — no \
prose outside the tags, no markdown, no code fences:\n\
\n\
<PROBLEM>One short paragraph explaining what's wrong (or what's being changed).</PROBLEM>\n\
<FIX_LABEL>A 3-7 word label for the fix (imperative).</FIX_LABEL>\n\
<ORIGINAL start_line=\"<N>\">\n\
<copy the exact lines you intend to replace, verbatim from the source window>\n\
</ORIGINAL>\n\
<REPLACEMENT>\n\
<the new lines that should replace them>\n\
</REPLACEMENT>\n\
<IMPACT>One sentence on the expected effect (perf, correctness, clarity).</IMPACT>\n\
\n\
Rules:\n\
- <ORIGINAL> must be a contiguous slice of the source window. Copy whitespace exactly.\n\
- start_line is the 1-based line number of the FIRST line of <ORIGINAL> in the file.\n\
- Keep the change minimal — fewest lines that fix the issue.\n\
- Do not output anything before <PROBLEM> or after </IMPACT>.";

fn build_user_prompt(
    file: &str,
    line: usize,
    start: usize,
    end: usize,
    slice: &str,
    ask: &str,
) -> String {
    format!(
        "File: {file}\n\
         Anchor line: {line}\n\
         Window: lines {start}-{end} (inclusive, 1-based).\n\n\
         User request: {ask}\n\n\
         Source window:\n\
         ```\n\
         {slice}\n\
         ```"
    )
}

fn build_provider(config: ModelBackend) -> anyhow::Result<Arc<dyn Provider>> {
    let ModelBackend::Api {
        base_url,
        api_key,
        model,
    } = config;
    Ok(Arc::new(OpenAiProvider::new(base_url, api_key, model)))
}

#[tauri::command]
pub async fn apply_patch(args: ApplyArgs) -> std::result::Result<ApplyResult, String> {
    let diff = synthesize_unified_diff(&args);
    let envelope = format!(
        "<FILE_CHANGES>\n<FILE_PATCH file_path=\"{}\">\n{}</FILE_PATCH>\n</FILE_CHANGES>",
        args.file, diff
    );

    let (changes, _) =
        udiffx::extract_file_changes(&envelope, false).map_err(|e| format!("parse: {e}"))?;
    // We embed absolute paths in `<FILE_PATCH file_path="...">`, so the
    // resolved target is `"/" + "/abs/foo.rs" == "/abs/foo.rs"`. udiffx
    // accepts anything that implements `Into<SPath>` — `&str` works.
    let status =
        udiffx::apply_file_changes("/", changes).map_err(|e| format!("apply: {e}"))?;

    let items = status
        .items
        .iter()
        .map(|it| ApplyItem {
            kind: it.kind().to_string(),
            file_path: it.file_path().to_string(),
            success: it.success,
            message: it.error_msg().map(|e| e.to_string()),
        })
        .collect::<Vec<_>>();
    let ok = items.iter().all(|i| i.success);
    Ok(ApplyResult { ok, items })
}

/// Build a one-hunk unified-diff body from `original`/`replacement`.
/// Format matches what `udiffx` expects inside a `<FILE_PATCH>`.
fn synthesize_unified_diff(args: &ApplyArgs) -> String {
    let old_lines: Vec<&str> = args.original.split('\n').collect();
    let new_lines: Vec<&str> = args.replacement.split('\n').collect();
    // Trailing-newline artifact: split() on "a\n" gives ["a", ""]. Drop the
    // empty tail so we don't emit a phantom `-` / `+` line.
    let old_lines: Vec<&str> = trim_trailing_empty(old_lines);
    let new_lines: Vec<&str> = trim_trailing_empty(new_lines);

    let mut out = String::new();
    out.push_str(&format!(
        "@@ -{},{} +{},{} @@\n",
        args.start_line,
        old_lines.len(),
        args.start_line,
        new_lines.len()
    ));
    for l in &old_lines {
        out.push('-');
        out.push_str(l);
        out.push('\n');
    }
    for l in &new_lines {
        out.push('+');
        out.push_str(l);
        out.push('\n');
    }
    out
}

fn trim_trailing_empty(mut v: Vec<&str>) -> Vec<&str> {
    while v.last().map_or(false, |s| s.is_empty()) {
        v.pop();
    }
    v
}
