# Live LLM → Suggested-Fix Card (Rust + React)

Goal: user picks a **file**, a **line**, types a **prompt** (or it's auto-derived from a static-analysis finding). Rust ships the surrounding code window + prompt to the LLM and **streams** a *structured* answer back — token by token, OpenAI-chat-completions-style. The React UI paints a **before/after suggested-fix card** in real time:

```
┌───────────────────────────────────────────────────────────────┐
│  ● N+1 Query Pattern in User Dashboard Loader  [CRITICAL]    │
│    src/services/UserService.ts:47  · 184 queries × ~2.1ms…   │
│                                                    +387ms    │
│                                                  P95 impact  │
├───────────────────────────────────────────────────────────────┤
│  PROBLEM                                                      │
│  Each user in the dashboard list triggers a separate query…  │
│                                                               │
│  CODE                                  TypeScript             │
│  ╔══════════════════════════════════════════════════════════╗ │
│  ║ 47  const users = await userRepo.findAll();              ║ │ ← red tint
│  ║ 48  for (const user of users) {                          ║ │
│  ║ 49    user.orders = await ordersRepo.findByUserId(...);  ║ │
│  ║ 50  }                                                    ║ │
│  ╚══════════════════════════════════════════════════════════╝ │
│                                                               │
│  SUGGESTED FIX            Replace with batched IN-query  -4 +3│
│  ╔══════════════════════════════════════════════════════════╗ │
│  ║ 47  const users = await userRepo.findAll();              ║ │ ← green tint
│  ║ 48  const orders = await ordersRepo.findByUserIds(...);  ║ │
│  ║ 49  const ordersByUser = _.groupBy(orders, 'userId');    ║ │
│  ║ 50  users.forEach(u => u.orders = ordersByUser[u.id]…);  ║ │
│  ╚══════════════════════════════════════════════════════════╝ │
│                                                               │
│  ⚡ Estimated improvement: ~370ms saved per request           │
└───────────────────────────────────────────────────────────────┘
```

User clicks **Apply** → Rust synthesizes a unified diff from `<ORIGINAL>` + `<REPLACEMENT>` and writes it to disk via `udiffx::apply_file_changes`.

---

## 1. Why this design

- **OpenAI-style delta streaming** — `Provider::stream` (drift-lab's trait over rig-core's OpenAI client) yields `Result<(Option<Message>, Option<Usage>), ProviderError>` per chunk. Each non-empty chunk is one `PatchEvent::Delta { text }` over a Tauri `Channel<T>`. React appends with `setBuffer(prev => prev + text)` — same pattern as the JS OpenAI client's `delta.content` accumulation. Already proven in [scan/suggester.rs:280-297](drift-lab/src-tauri/src/scan/suggester.rs#L280-L297).
- **Tauri `Channel<T>` over `app.emit`** — channels are ordered, typed, scoped to one invoke call. Recommended for streamed payloads ([docs.rs/tauri Channel](https://docs.rs/tauri/latest/tauri/ipc/struct.Channel.html)).
- **Structured XML envelope from the LLM** — not raw unified diff. Each section (`<PROBLEM>`, `<ORIGINAL>`, `<REPLACEMENT>`, `<IMPACT>`) is independently streamable and maps 1:1 to a card section. As tokens arrive, partial extraction grows the matching section — no diff parser needed during streaming.
- **Synthesized unified diff at apply time** — we have the LLM's `<ORIGINAL>` (copied verbatim from the source window we sent it) and `<REPLACEMENT>`. Server builds `--- a/<file>\n+++ b/<file>\n@@ -<start>,<n> +<start>,<m> @@\n-…\n+…\n` and hands it to `udiffx::apply_file_changes`. udiffx is resilient to whitespace drift, so even if the LLM's original drifted by a blank line it still applies.
- **Prism-react-renderer over react-diff-view** — react-diff-view's split/unified layouts don't match the stacked card aesthetic. `prism-react-renderer` gives token streams we render line-by-line with our own gutter + background, total control.

---

## 2. `src-tauri/Cargo.toml` — additions

```toml
udiffx = { version = "0.1", features = ["prompt"] }
# uuid already used in drift-lab; if not present:
# uuid = { version = "1", features = ["v4"] }
```

(If crates.io trails, point at git: `udiffx = { git = "https://github.com/jeremychone/rust-udiffx", features = ["prompt"] }`.)

---

## 3. Rust types (`src-tauri/src/patch/types.rs`)

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PatchEvent {
    Started { request_id: String },
    Delta { text: String },
    Done { full_text: String },
    Error { message: String },
}

/// What the UI passes to `apply_patch` after the user clicks Apply.
/// We send the parsed sections, not the raw LLM text, so the server
/// doesn't need to re-parse the streaming buffer.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyArgs {
    pub file: String,
    pub start_line: usize,
    pub original: String,
    pub replacement: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResult {
    pub ok: bool,
    pub items: Vec<ApplyItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyItem {
    pub kind: String,
    pub file_path: String,
    pub success: bool,
    pub message: Option<String>,
}
```

`src-tauri/src/patch/mod.rs`:
```rust
pub mod commands;
pub mod types;
```

Register in `src-tauri/src/lib.rs`:
```rust
mod patch;
```

---

## 4. Rust commands (`src-tauri/src/patch/commands.rs`)

```rust
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result};
use futures_util::StreamExt;
use tauri::{ipc::Channel, AppHandle, Runtime, State};

use crate::agent::provider::Provider;
use crate::agent::types::{Message, MessageContent, Role};
use crate::agent::OpenAiProvider;
use crate::app_config::ModelBackend;
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
) -> Result<(), String> {
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

fn build_provider(
    config: ModelBackend,
) -> anyhow::Result<Arc<dyn Provider>> {
    let ModelBackend::Api { base_url, api_key, model } = config;
    Ok(Arc::new(OpenAiProvider::new(base_url, api_key, model)))
}

/// Apply the parsed sections to disk by synthesizing a one-hunk unified diff.
/// We hand it to udiffx so we get whitespace-drift tolerance + per-hunk
/// success reporting for free.
#[tauri::command]
pub async fn apply_patch(args: ApplyArgs) -> Result<ApplyResult, String> {
    let diff = synthesize_unified_diff(&args);
    let envelope = format!(
        "<FILE_CHANGES>\n<FILE_PATCH file_path=\"{}\">\n{}\n</FILE_PATCH>\n</FILE_CHANGES>",
        args.file, diff
    );

    let (changes, _) = udiffx::extract_file_changes(&envelope, false)
        .map_err(|e| format!("parse: {e}"))?;
    // udiffx writes paths relative to base_dir; with an absolute file we use "/" as the base.
    let base = simple_fs::SPath::new("/");
    let status = udiffx::apply_file_changes(&base, changes)
        .map_err(|e| format!("apply: {e}"))?;

    let items = status
        .items
        .iter()
        .map(|it| ApplyItem {
            kind: it.kind().to_string(),
            file_path: it.file_path().to_string(),
            success: it.is_success(),
            message: it.error().map(|e| e.to_string()),
        })
        .collect::<Vec<_>>();
    let ok = items.iter().all(|i| i.success);
    Ok(ApplyResult { ok, items })
}

fn synthesize_unified_diff(args: &ApplyArgs) -> String {
    let old_lines: Vec<&str> = args.original.lines().collect();
    let new_lines: Vec<&str> = args.replacement.lines().collect();
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
```

Register both commands in `src-tauri/src/lib.rs` (extend the existing `generate_handler!` block):

```rust
.invoke_handler(tauri::generate_handler![
    // … existing commands …
    crate::patch::commands::start_patch,
    crate::patch::commands::apply_patch,
])
```

---

## 5. React deps (`desktop-ui/package.json`)

```jsonc
"dependencies": {
  "prism-react-renderer": "^2.4.0",
  // … existing …
}
```

---

## 6. React TS wire types (`desktop-ui/src/lib/patch.ts`)

```typescript
export type PatchEvent =
  | { type: "started"; requestId: string }
  | { type: "delta"; text: string }
  | { type: "done"; fullText: string }
  | { type: "error"; message: string };

export interface PatchSections {
  problem: string;
  fixLabel: string;
  originalStartLine: number | null;
  original: string;
  replacement: string;
  impact: string;
  // True once the full </IMPACT> close tag has been seen.
  complete: boolean;
}

export interface ApplyResult {
  ok: boolean;
  items: { kind: string; filePath: string; success: boolean; message: string | null }[];
}
```

---

## 7. React streaming hook (`desktop-ui/src/lib/usePatchStream.ts`)

```typescript
import { Channel, invoke } from "@tauri-apps/api/core";
import { useCallback, useMemo, useRef, useState } from "react";
import { extractSections } from "./extractSections";
import type { PatchEvent, PatchSections } from "./patch";

interface StartArgs {
  file: string;
  line: number;
  prompt: string;
}

type Status = "idle" | "streaming" | "done" | "error";

export function usePatchStream() {
  const [buffer, setBuffer] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef<symbol | null>(null);

  const start = useCallback(async (args: StartArgs) => {
    const token = Symbol("patch");
    activeRef.current = token;
    setBuffer("");
    setError(null);
    setStatus("streaming");

    const channel = new Channel<PatchEvent>();
    channel.onmessage = (e) => {
      if (activeRef.current !== token) return;
      switch (e.type) {
        case "delta":
          setBuffer((p) => p + e.text);
          break;
        case "done":
          setBuffer(e.fullText);
          setStatus("done");
          break;
        case "error":
          setError(e.message);
          setStatus("error");
          break;
      }
    };

    try {
      await invoke("start_patch", { ...args, channel });
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }, []);

  const sections: PatchSections = useMemo(() => extractSections(buffer), [buffer]);

  return { buffer, sections, status, error, start };
}
```

---

## 8. Partial-XML extractor (`desktop-ui/src/lib/extractSections.ts`)

Streaming a `<PROBLEM>foo</PROBLEM>…` buffer: at any frame, some tags are open, some are closed. We greedily pull each section's body — closed tags get the slice between open/close; open-but-not-closed tags get the slice up to the buffer end (so the UI grows live). Each section is independent — no cross-state.

```typescript
import type { PatchSections } from "./patch";

const EMPTY: PatchSections = {
  problem: "",
  fixLabel: "",
  originalStartLine: null,
  original: "",
  replacement: "",
  impact: "",
  complete: false,
};

function pull(buffer: string, tag: string, openExtra = ""): string {
  // openExtra captures attributes (start_line="47"). We allow it to be empty.
  const open = new RegExp(`<${tag}(?:\\s+[^>]*)?>`);
  const m = buffer.match(open);
  if (!m || m.index === undefined) return "";
  const bodyStart = m.index + m[0].length;
  const close = `</${tag}>`;
  const closeIdx = buffer.indexOf(close, bodyStart);
  const raw = closeIdx === -1 ? buffer.slice(bodyStart) : buffer.slice(bodyStart, closeIdx);
  return raw.replace(/^\n/, "").replace(/\n$/, "");
}

function pullStartLine(buffer: string): number | null {
  const m = buffer.match(/<ORIGINAL\s+start_line="(\d+)"\s*>/);
  return m ? Number(m[1]) : null;
}

export function extractSections(buffer: string): PatchSections {
  if (!buffer) return EMPTY;
  return {
    problem: pull(buffer, "PROBLEM"),
    fixLabel: pull(buffer, "FIX_LABEL"),
    originalStartLine: pullStartLine(buffer),
    original: pull(buffer, "ORIGINAL"),
    replacement: pull(buffer, "REPLACEMENT"),
    impact: pull(buffer, "IMPACT"),
    complete: buffer.includes("</IMPACT>"),
  };
}
```

---

## 9. Line-numbered, syntax-highlighted code block (`desktop-ui/src/components/patch/CodeLines.tsx`)

```tsx
import { Highlight, themes, type Language } from "prism-react-renderer";

interface Props {
  code: string;
  language: Language;
  startLine: number;
  /** "remove" → red tint, "add" → green tint, "none" → plain */
  variant?: "remove" | "add" | "none";
}

export function CodeLines({ code, language, startLine, variant = "none" }: Props) {
  // Trailing newline produces an empty last line; trim it so we don't render
  // an extra blank gutter row at the bottom of every block.
  const body = code.replace(/\n$/, "");

  return (
    <Highlight code={body} language={language} theme={themes.github}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={`code-lines code-lines--${variant} ${className}`}
          style={{ ...style, margin: 0 }}
        >
          {tokens.map((line, i) => {
            const { key, ...lineProps } = getLineProps({ line });
            return (
              <div
                key={i}
                {...lineProps}
                className={`code-line code-line--${variant}`}
              >
                <span className="code-line__num">{startLine + i}</span>
                <span className="code-line__text">
                  {line.map((token, j) => {
                    const { key: _k, ...tokenProps } = getTokenProps({ token });
                    return <span key={j} {...tokenProps} />;
                  })}
                </span>
              </div>
            );
          })}
        </pre>
      )}
    </Highlight>
  );
}
```

CSS (drop into `desktop-ui/src/styles/globals.css`):

```css
.code-lines { font-family: var(--mono, ui-monospace, Menlo, monospace);
              font-size: 13px; line-height: 1.5; padding: 0; overflow-x: auto;
              border-radius: 6px; }
.code-line { display: grid; grid-template-columns: 3.5em 1fr;
             padding: 0 0.5em; }
.code-line__num { color: #9aa0a6; text-align: right; padding-right: 1em;
                  user-select: none; }
.code-line--remove { background: rgba(255, 87, 87, 0.10); }
.code-line--remove .code-line__num { color: #d05656; }
.code-line--add    { background: rgba(46, 160, 67, 0.12); }
.code-line--add    .code-line__num { color: #2a8c43; }
```

---

## 10. The card (`desktop-ui/src/components/patch/PatchCard.tsx`)

```tsx
import type { Language } from "prism-react-renderer";
import type { PatchSections } from "../../lib/patch";
import { CodeLines } from "./CodeLines";

interface Props {
  /** UI metadata for the header — these come from the static-analysis
   *  finding when present; otherwise the caller supplies fallbacks. */
  title: string;
  severity?: "critical" | "high" | "medium" | "low";
  file: string;
  line: number;
  impactBadge?: string;       // e.g. "+387ms"
  impactSubtitle?: string;    // e.g. "P95 impact"
  metaLine?: string;          // e.g. "184 queries × ~2.1ms each · Database overuse"
  language: Language;

  sections: PatchSections;
  streaming: boolean;
  onApply: () => void;
  applyDisabled?: boolean;
}

export function PatchCard({
  title,
  severity = "critical",
  file,
  line,
  impactBadge,
  impactSubtitle,
  metaLine,
  language,
  sections,
  streaming,
  onApply,
  applyDisabled,
}: Props) {
  const startLine = sections.originalStartLine ?? line;
  const removedCount = sections.original ? sections.original.split("\n").length : 0;
  const addedCount = sections.replacement ? sections.replacement.split("\n").length : 0;

  return (
    <article className="patch-card">
      <header className="patch-card__head">
        <div className="patch-card__title">
          <span className={`dot dot--${severity}`} />
          <h2>{title}</h2>
          <span className={`badge badge--${severity}`}>{severity.toUpperCase()}</span>
        </div>
        <div className="patch-card__meta">
          <code>{file}:{line}</code>
          {metaLine && <span className="muted"> · {metaLine}</span>}
        </div>
        {impactBadge && (
          <div className="patch-card__impact">
            <div className="patch-card__impact-value">{impactBadge}</div>
            {impactSubtitle && <div className="muted">{impactSubtitle}</div>}
          </div>
        )}
      </header>

      <section className="patch-card__section">
        <h3>PROBLEM</h3>
        <p className="patch-card__problem">
          {sections.problem || (streaming ? <Skeleton /> : "—")}
        </p>
      </section>

      <section className="patch-card__section">
        <div className="patch-card__section-head">
          <h3>CODE</h3>
          <span className="muted">{languageLabel(language)}</span>
        </div>
        {sections.original ? (
          <CodeLines
            code={sections.original}
            language={language}
            startLine={startLine}
            variant="remove"
          />
        ) : (
          streaming && <Skeleton block />
        )}
      </section>

      <section className="patch-card__section">
        <div className="patch-card__section-head">
          <h3>SUGGESTED FIX</h3>
          <span className="muted">{sections.fixLabel || (streaming ? "…" : "")}</span>
          {(removedCount || addedCount) && (
            <span className="muted">-{removedCount} +{addedCount}</span>
          )}
        </div>
        {sections.replacement ? (
          <CodeLines
            code={sections.replacement}
            language={language}
            startLine={startLine}
            variant="add"
          />
        ) : (
          streaming && <Skeleton block />
        )}
      </section>

      {sections.impact && (
        <footer className="patch-card__footer">
          <span className="patch-card__bolt" aria-hidden>⚡</span>
          <div>
            <strong>Estimated improvement: </strong>
            <span>{sections.impact}</span>
          </div>
        </footer>
      )}

      <div className="patch-card__actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={applyDisabled || streaming || !sections.complete}
          onClick={onApply}
        >
          Apply
        </button>
      </div>
    </article>
  );
}

function languageLabel(lang: Language): string {
  switch (lang) {
    case "tsx": case "typescript": return "TypeScript";
    case "jsx": case "javascript": return "JavaScript";
    case "rust": return "Rust";
    case "python": return "Python";
    default: return lang;
  }
}

function Skeleton({ block = false }: { block?: boolean }) {
  return <span className={block ? "skeleton skeleton--block" : "skeleton"} />;
}
```

Card CSS (extend `globals.css`):

```css
.patch-card { border: 1px solid var(--border, #e5e7eb); border-radius: 10px;
              background: var(--surface, #fff); overflow: hidden; }
.patch-card__head { display: grid;
                    grid-template-columns: 1fr auto;
                    gap: 0.5rem 1rem; padding: 0.9rem 1rem;
                    border-bottom: 1px solid var(--border, #e5e7eb); }
.patch-card__title { display: flex; align-items: center; gap: 0.5rem;
                     grid-column: 1; }
.patch-card__title h2 { font-size: 1rem; margin: 0; font-weight: 600; }
.patch-card__meta { grid-column: 1; font-size: 0.85rem; }
.patch-card__impact { grid-column: 2; grid-row: 1 / span 2; text-align: right; }
.patch-card__impact-value { font-size: 1.1rem; font-weight: 600; color: #d62828; }

.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot--critical { background: #d62828; }
.dot--high     { background: #ef6c00; }
.dot--medium   { background: #f4b400; }
.dot--low      { background: #6aa84f; }

.badge { font-size: 0.7rem; font-weight: 700; padding: 2px 6px;
         border-radius: 4px; letter-spacing: 0.04em; }
.badge--critical { background: #fde2e2; color: #b91c1c; }

.patch-card__section { padding: 0.9rem 1rem;
                       border-bottom: 1px solid var(--border, #e5e7eb); }
.patch-card__section h3 { font-size: 0.7rem; letter-spacing: 0.08em;
                          color: #6b7280; margin: 0 0 0.4rem; font-weight: 700; }
.patch-card__section-head { display: flex; align-items: baseline; gap: 0.6rem;
                            margin-bottom: 0.4rem; }
.patch-card__problem { margin: 0; color: #374151; line-height: 1.5; }
.muted { color: #6b7280; font-size: 0.8rem; }

.patch-card__footer { display: flex; gap: 0.6rem; padding: 0.8rem 1rem;
                      background: #f0fdf4; border-bottom: 1px solid var(--border, #e5e7eb); }
.patch-card__bolt { width: 24px; height: 24px; display: inline-flex;
                    align-items: center; justify-content: center;
                    background: #fb923c; border-radius: 6px; }

.patch-card__actions { padding: 0.8rem 1rem; display: flex; justify-content: flex-end; }
.btn--primary { background: #2563eb; color: white; border: 0; border-radius: 6px;
                padding: 0.45rem 0.9rem; font-weight: 600; cursor: pointer; }
.btn--primary:disabled { background: #9ca3af; cursor: not-allowed; }

.skeleton { display: inline-block; width: 60%; height: 1em;
            background: linear-gradient(90deg, #f3f4f6 0, #e5e7eb 50%, #f3f4f6 100%);
            background-size: 200% 100%; animation: shimmer 1.2s infinite;
            border-radius: 4px; }
.skeleton--block { display: block; width: 100%; height: 4em; }
@keyframes shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }
```

---

## 11. The host panel (`desktop-ui/src/components/patch/PatchPanel.tsx`)

```tsx
import { invoke } from "@tauri-apps/api/core";
import type { Language } from "prism-react-renderer";
import { useState } from "react";
import { usePatchStream } from "../../lib/usePatchStream";
import type { ApplyResult } from "../../lib/patch";
import { PatchCard } from "./PatchCard";

interface Props {
  file: string;
  line: number;
  language: Language;
  title?: string;
  metaLine?: string;
  impactBadge?: string;
  impactSubtitle?: string;
}

export function PatchPanel({
  file,
  line,
  language,
  title = "AI-suggested change",
  metaLine,
  impactBadge,
  impactSubtitle,
}: Props) {
  const { sections, status, error, start } = usePatchStream();
  const [prompt, setPrompt] = useState("");
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [applying, setApplying] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || status === "streaming") return;
    setApplyResult(null);
    void start({ file, line, prompt });
  };

  const onApply = async () => {
    if (!sections.complete) return;
    setApplying(true);
    try {
      const result = await invoke<ApplyResult>("apply_patch", {
        args: {
          file,
          startLine: sections.originalStartLine ?? line,
          original: sections.original,
          replacement: sections.replacement,
        },
      });
      setApplyResult(result);
    } catch (e) {
      setApplyResult({
        ok: false,
        items: [{ kind: "ERROR", filePath: file, success: false, message: String(e) }],
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="patch-panel">
      <form className="patch-panel__prompt" onSubmit={submit}>
        <code className="muted">{file}:{line}</code>
        <textarea
          rows={2}
          placeholder="What should change here?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={status === "streaming"}
        />
        <button type="submit" disabled={status === "streaming" || !prompt.trim()}>
          {status === "streaming" ? "Streaming…" : "Generate"}
        </button>
      </form>

      {error && <div className="patch-panel__error">{error}</div>}

      {(status !== "idle") && (
        <PatchCard
          title={title}
          file={file}
          line={line}
          metaLine={metaLine}
          impactBadge={impactBadge}
          impactSubtitle={impactSubtitle}
          language={language}
          sections={sections}
          streaming={status === "streaming"}
          onApply={onApply}
          applyDisabled={applying}
        />
      )}

      {applyResult && (
        <div className={applyResult.ok ? "ok" : "err"}>
          {applyResult.items.map((it) => (
            <div key={it.filePath}>
              {it.success ? "✓" : "✗"} {it.kind} {it.filePath}
              {it.message && ` — ${it.message}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 12. End-to-end flow recap

1. User submits prompt → `invoke("start_patch", { file, line, prompt, channel })`.
2. Rust spawns a task: reads ±60-line window, builds system + user prompt, opens `provider.stream(...)`.
3. For each non-empty chunk: `channel.send(Delta { text })` — **one Channel send per provider delta, exactly like OpenAI chat completions**.
4. React `setBuffer(prev => prev + text)` on each delta. `extractSections(buffer)` runs in `useMemo`. The card's PROBLEM / CODE / SUGGESTED FIX / IMPACT subtrees grow independently as their `</TAG>` close tags arrive.
5. On `Done { full_text }`, React reconciles `buffer = fullText` (covers any dropped frames) and sets `status = "done"`. The Apply button enables.
6. User clicks Apply → `invoke("apply_patch", { args: { file, startLine, original, replacement } })`.
7. Rust synthesizes a `<FILE_PATCH>` envelope from those four fields, hands it to `udiffx::apply_file_changes`, returns the per-directive status.

---

## Sources

- [otakustay/react-diff-view](https://github.com/otakustay/react-diff-view) — considered for split/unified, dropped in favor of stacked card aesthetic
- [prism-react-renderer](https://github.com/FormidableLabs/prism-react-renderer) — token-level syntax highlighting
- [jeremychone/rust-udiffx](https://github.com/jeremychone/rust-udiffx) — `extract_file_changes`, `apply_file_changes`, fuzzy patch apply
- [tauri::ipc::Channel](https://docs.rs/tauri/latest/tauri/ipc/struct.Channel.html) — ordered streaming IPC
- [Tauri Calling Rust from the Frontend](https://v2.tauri.app/develop/calling-rust/) — `new Channel<T>()`, `channel.onmessage`
- [rig-core docs](https://docs.rs/rig-core/latest/rig/) — streaming completion traits
- Drift-lab's existing pattern in [scan/suggester.rs:225-317](drift-lab/src-tauri/src/scan/suggester.rs#L225-L317) — same start/delta/done envelope, ported to Channel
