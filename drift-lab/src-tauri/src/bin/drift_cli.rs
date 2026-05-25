//! `drift` — a minimal CLI to drive the running Drift Lab desktop app.
//!
//! Three verbs, no abstractions:
//!
//! * `drift start` — launch the desktop app (platform-native).
//! * `drift stop`  — POST `/api/shutdown` to the running instance.
//! * `drift logs`  — stream `/api/logs/stream` (Server-Sent Events) to stdout.
//!
//! The CLI talks to the bundled axum server on `127.0.0.1:5151`. It does
//! not import `drift_lab_lib`: parsing the JSON shapes by field keeps
//! the binary small and the wire contract honest — both sides agree on
//! `LogLine`'s camelCase keys (`level`, `target`, `message`) and the
//! `kind`-tagged shutdown response.
//!
//! Output style mirrors `drift-lab/Makefile`: `▶` blue for in-progress,
//! `✓` green for success, `!` yellow for hints, `✗` red for failure.
//! Colours respect the `NO_COLOR` convention and auto-disable when the
//! output isn't a TTY (so pipes / files / `tee` stay clean).

use std::io::{IsTerminal, Write};
use std::process::{exit, Command};
#[cfg(target_os = "linux")]
use std::process::Stdio;

use clap::{Parser, Subcommand};
use futures_util::StreamExt;

/// Loopback URL the bundled HTTP server binds to. Kept in sync with
/// `crate::http_server::DEFAULT_PORT` (5151) on the backend side.
const BASE_URL: &str = "http://127.0.0.1:5151";

// ── ANSI styles ─────────────────────────────────────────────────────────────
// Same palette as drift-lab/Makefile so CLI + build output feel like one tool.

const BLUE: &str = "\x1b[1;34m";
const GREEN: &str = "\x1b[1;32m";
const YELLOW: &str = "\x1b[1;33m";
const RED: &str = "\x1b[1;31m";
const CYAN: &str = "\x1b[36m";
const DIM: &str = "\x1b[2m";
const RESET: &str = "\x1b[0m";

/// `true` when we should emit ANSI escapes. Disabled when:
///   - `NO_COLOR` env var is set (https://no-color.org/),
///   - stdout isn't a TTY (piped / redirected),
///   - or we're inside `cargo test` (deterministic test output).
fn use_color() -> bool {
    if cfg!(test) {
        return false;
    }
    std::env::var_os("NO_COLOR").is_none() && std::io::stdout().is_terminal()
}

/// Wrap `text` in `color` if colour output is enabled.
fn paint(color: &str, text: &str) -> String {
    if use_color() {
        format!("{color}{text}{RESET}")
    } else {
        text.to_string()
    }
}

/// `▶ <text>` — work in progress (blue).
fn info(text: &str) -> String {
    format!("{} {}", paint(BLUE, "▶"), text)
}

/// `✓ <text>` — success (green).
fn ok(text: &str) -> String {
    format!("{} {}", paint(GREEN, "✓"), text)
}

/// `! <text>` — hint or warning (yellow).
fn hint(text: &str) -> String {
    format!("{} {}", paint(YELLOW, "!"), text)
}

/// `✗ <text>` — failure (red). Use for the "drift: …" error line.
fn fail(text: &str) -> String {
    format!("{} {}", paint(RED, "✗"), text)
}

// ── CLI ─────────────────────────────────────────────────────────────────────

#[derive(Parser)]
#[command(
    name = "drift",
    version,
    about = "Control the running Drift Lab desktop app",
    long_about = "drift talks to a running Drift Lab on 127.0.0.1:5151.\n\
                  Run `drift start` to launch the app, then `drift logs` or `drift stop`."
)]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Launch the Drift Lab desktop app. No-op if already running.
    Start,
    /// Gracefully shut down a running Drift Lab.
    Stop,
    /// Stream live logs from the running Drift Lab.
    Logs,
}

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let cli = Cli::parse();
    let result = match cli.cmd {
        Cmd::Start => start(BASE_URL),
        Cmd::Stop => stop(BASE_URL).await,
        Cmd::Logs => logs(BASE_URL).await,
    };
    if let Err(e) = result {
        eprintln!("{}", fail(&format!("drift: {e}")));
        exit(1);
    }
}

// ---------- start ------------------------------------------------------------

/// Spawn the platform-native launcher for "Drift Lab". The CLI does not
/// wait for the app to come up — that's deliberately the user's job
/// (`drift logs` will fail with a friendly message if they jump the gun).
fn start(base_url: &str) -> Result<(), String> {
    let target = match std::env::consts::OS {
        "macos" => "Drift Lab (mac)",
        "linux" => "drift-lab (Linux)",
        "windows" => "Drift Lab (Windows)",
        other => other,
    };
    println!("{}", info(&format!("launching {target}")));

    let outcome: std::io::Result<std::process::ExitStatus> = {
        #[cfg(target_os = "macos")]
        {
            // `-a` looks the app up by name in Applications + recents;
            // works whether the user installed via .dmg or via the
            // updater-extracted .app.tar.gz.
            Command::new("open").args(["-a", "Drift Lab"]).status()
        }
        #[cfg(target_os = "linux")]
        {
            // Prefer the .desktop entry if installed; fall back to the
            // raw binary. `.deb` installs both; AppImage installs
            // neither — in that case the user runs the AppImage
            // directly and the first-launch installer puts `drift` on
            // PATH for next time.
            if Command::new("gtk-launch").arg("drift-lab").status().is_ok_and(|s| s.success()) {
                Ok(std::process::ExitStatus::default())
            } else {
                Command::new("drift-lab").stdout(Stdio::null()).stderr(Stdio::null()).status()
            }
        }
        #[cfg(target_os = "windows")]
        {
            Command::new("cmd").args(["/C", "start", "", "Drift Lab"]).status()
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
        {
            return Err("unsupported platform".into());
        }
    };

    match outcome {
        Ok(s) if s.success() => {
            println!("{}", ok("Drift Lab launched"));
            println!(
                "{}",
                hint(&format!(
                    "follow live logs with `drift logs` · stop with `drift stop` · UI at {base_url}"
                ))
            );
            Ok(())
        }
        Ok(s) => Err(format!("launcher exited with status {s}")),
        Err(e) => Err(format!("failed to launch Drift Lab: {e}")),
    }
}

// ---------- stop -------------------------------------------------------------

async fn stop(base_url: &str) -> Result<(), String> {
    let url = format!("{base_url}/api/shutdown");
    println!("{}", info(&format!("requesting shutdown via {url}")));
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| format!("client build: {e}"))?;
    let resp = client
        .post(&url)
        .send()
        .await
        .map_err(|e| format!("connect failed (is Drift Lab running?): {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("server responded {}", resp.status()));
    }
    println!("{}", ok("Drift Lab shutting down"));
    Ok(())
}

// ---------- logs -------------------------------------------------------------

async fn logs(base_url: &str) -> Result<(), String> {
    let url = format!("{base_url}/api/logs/stream");
    eprintln!("{}", info(&format!("streaming logs from {url}")));
    eprintln!("{}", hint("Ctrl+C to stop · NO_COLOR=1 to disable colours"));
    eprintln!();

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("connect failed (is Drift Lab running?): {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("server responded {}", resp.status()));
    }
    let mut stream = resp.bytes_stream();
    let mut buf: Vec<u8> = Vec::with_capacity(4096);
    let mut stdout = std::io::stdout().lock();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("stream error: {e}"))?;
        buf.extend_from_slice(&chunk);
        // SSE frames are delimited by a blank line — "\n\n". Drain
        // every complete frame in the buffer; leave any tail behind.
        while let Some(end) = find_double_newline(&buf) {
            let frame_bytes: Vec<u8> = buf.drain(..end + 2).collect();
            if let Some(line) = format_sse_frame(&frame_bytes) {
                let _ = writeln!(stdout, "{line}");
                let _ = stdout.flush();
            }
        }
    }
    Ok(())
}

/// Return the index of the first `\n` in the `\n\n` boundary, or `None`
/// if not yet present.
fn find_double_newline(b: &[u8]) -> Option<usize> {
    b.windows(2).position(|w| w == b"\n\n")
}

/// Format one SSE frame for display. Returns `None` for keep-alive
/// comments (starting with `:`) and other frames with no `data:` line.
fn format_sse_frame(frame: &[u8]) -> Option<String> {
    let text = std::str::from_utf8(frame).ok()?;
    let mut event = "log";
    let mut data: Option<&str> = None;
    for line in text.lines() {
        if let Some(rest) = line.strip_prefix("event:") {
            event = rest.trim();
        } else if let Some(rest) = line.strip_prefix("data:") {
            data = Some(rest.trim_start());
        }
    }
    let data = data?;
    match event {
        "log" => Some(format_log_payload(data)),
        "lagged" => {
            // Yellow `!` — same sigil as Makefile hints, since "you
            // missed N lines" is a hint to slow down your reader.
            Some(format!("{} {}", paint(YELLOW, "!"), paint(YELLOW, &format!("lagged: {data}"))))
        }
        other => Some(format!("[event:{other}] {data}")),
    }
}

/// Pretty-print one `LogLine` JSON payload. Falls back to the raw JSON
/// if the shape doesn't match — never fail to display a line.
fn format_log_payload(data: &str) -> String {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(data) else {
        return data.to_string();
    };
    let level = v.get("level").and_then(|x| x.as_str()).unwrap_or("");
    let target = v.get("target").and_then(|x| x.as_str()).unwrap_or("");
    let message = v.get("message").and_then(|x| x.as_str()).unwrap_or("");
    let ts_ms = v.get("tsMs").and_then(|x| x.as_i64()).unwrap_or(0);

    let ts = format_timestamp(ts_ms);
    let target_short = shorten_target(target);
    let level_padded = format!("{level:>5}");
    let level_color = level_color_for(level);

    if use_color() {
        format!(
            "{DIM}{ts}{RESET}  {level_color}{level_padded}{RESET}  {CYAN}{target_short}{RESET}  {message}"
        )
    } else {
        format!("{ts}  {level_padded}  {target_short}  {message}")
    }
}

/// `HH:MM:SS.mmm` in local time. Falls back to the raw millis on epoch
/// overflow (which would mean someone sent us a bogus tsMs).
fn format_timestamp(ts_ms: i64) -> String {
    use chrono::{Local, TimeZone};
    match Local.timestamp_millis_opt(ts_ms).single() {
        Some(t) => t.format("%H:%M:%S%.3f").to_string(),
        None => format!("{ts_ms}"),
    }
}

/// `drift_lab_lib::agent::workflow` → `agent::workflow`. Mirrors the
/// renderer's `shortenTarget` so CLI and UI render identically.
fn shorten_target(target: &str) -> String {
    let parts: Vec<&str> = target.split("::").collect();
    if parts.len() <= 2 {
        target.to_string()
    } else {
        parts[parts.len() - 2..].join("::")
    }
}

fn level_color_for(level: &str) -> &'static str {
    match level.to_ascii_uppercase().as_str() {
        "ERROR" => RED,
        "WARN" | "WARNING" => YELLOW,
        "INFO" => BLUE,
        "DEBUG" => CYAN,
        _ => DIM,
    }
}

// ---------- tests ------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    /// `drift stop` POSTs `/api/shutdown` and exits 0 when the server
    /// returns 2xx. This is the load-bearing happy path.
    #[tokio::test]
    async fn stop_posts_shutdown_and_returns_ok() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/api/shutdown"))
            .respond_with(ResponseTemplate::new(202))
            .expect(1)
            .mount(&server)
            .await;

        stop(&server.uri()).await.expect("stop should succeed");
    }

    #[tokio::test]
    async fn stop_errors_on_5xx() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/api/shutdown"))
            .respond_with(ResponseTemplate::new(500))
            .mount(&server)
            .await;

        let err = stop(&server.uri()).await.expect_err("expected error");
        assert!(err.contains("500"), "msg should include status, got: {err}");
    }

    #[tokio::test]
    async fn stop_friendly_message_when_no_server() {
        let err = stop("http://127.0.0.1:1").await.expect_err("expected error");
        assert!(
            err.contains("is Drift Lab running"),
            "msg should hint at startup, got: {err}"
        );
    }

    #[test]
    fn format_sse_frame_log_event() {
        let frame = b"event: log\ndata: {\"level\":\"INFO\",\"target\":\"x::y\",\"message\":\"hi\",\"tsMs\":0}\n\n";
        let out = format_sse_frame(frame).expect("parse");
        assert!(out.contains("INFO"));
        assert!(out.contains("x::y"));
        assert!(out.contains("hi"));
    }

    #[test]
    fn format_sse_frame_lagged_event() {
        let frame = b"event: lagged\ndata: {\"dropped\":42}\n\n";
        let out = format_sse_frame(frame).expect("parse");
        assert!(out.contains("lagged"));
        assert!(out.contains("42"));
    }

    #[test]
    fn format_sse_frame_skips_keepalive() {
        assert!(format_sse_frame(b":\n\n").is_none());
    }

    #[tokio::test]
    async fn logs_consumes_sse_stream() {
        let server = MockServer::start().await;
        let body = "event: log\ndata: {\"level\":\"INFO\",\"target\":\"t\",\"message\":\"hello\",\"tsMs\":0}\n\n";
        Mock::given(method("GET"))
            .and(path("/api/logs/stream"))
            .respond_with(ResponseTemplate::new(200).set_body_string(body))
            .expect(1)
            .mount(&server)
            .await;
        logs(&server.uri()).await.expect("logs should succeed");
    }

    #[test]
    fn find_double_newline_returns_first_newline_index() {
        let s = b"abc\n\ndef";
        assert_eq!(find_double_newline(s), Some(3));
    }

    // ── New style/formatting tests ──────────────────────────────────────────

    /// In tests, `use_color()` returns `false` — so the helpers must
    /// emit plain text with the sigil prefix only. This is what makes
    /// the substring assertions in the other tests reliable across
    /// TTY / non-TTY runners.
    #[test]
    fn style_helpers_are_plain_in_tests() {
        assert_eq!(info("hi"), "▶ hi");
        assert_eq!(ok("done"), "✓ done");
        assert_eq!(hint("note"), "! note");
        assert_eq!(fail("oops"), "✗ oops");
    }

    /// Target shortener mirrors the UI: deep paths collapse to the
    /// last two segments; short paths pass through unchanged.
    #[test]
    fn shorten_target_keeps_last_two_segments() {
        assert_eq!(shorten_target("drift_lab_lib::agent::workflow"), "agent::workflow");
        assert_eq!(shorten_target("scan::runner"), "scan::runner");
        assert_eq!(shorten_target("module"), "module");
        assert_eq!(shorten_target("a::b::c::d"), "c::d");
    }

    /// Level → colour mapping is the load-bearing piece of how the log
    /// pane reads at a glance.
    #[test]
    fn level_colour_dispatch() {
        assert_eq!(level_color_for("ERROR"), RED);
        assert_eq!(level_color_for("WARN"), YELLOW);
        assert_eq!(level_color_for("WARNING"), YELLOW);
        assert_eq!(level_color_for("INFO"), BLUE);
        assert_eq!(level_color_for("DEBUG"), CYAN);
        assert_eq!(level_color_for("trace"), DIM);
        assert_eq!(level_color_for("???"), DIM);
    }

    /// Formatted log line contains the timestamp, padded level, short
    /// target, and message — in that order. We check structure rather
    /// than exact bytes so the test stays robust against minor format
    /// tweaks.
    #[test]
    fn format_log_payload_lays_out_columns() {
        let data = r#"{"level":"INFO","target":"drift_lab_lib::scan::runner","message":"scan started","tsMs":0}"#;
        let out = format_log_payload(data);
        let info_idx = out.find("INFO").expect("INFO present");
        let target_idx = out.find("scan::runner").expect("shortened target present");
        let msg_idx = out.find("scan started").expect("message present");
        assert!(info_idx < target_idx, "level before target");
        assert!(target_idx < msg_idx, "target before message");
    }
}
