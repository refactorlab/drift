//! Localhost HTTP server bundled inside the drift-lab desktop app.
//!
//! Why this exists: drift-lab already produces two artifacts the user wants
//! a browser-accessible surface for —
//!   1. The static-profiler viewer (a React SPA) that renders a `Report`,
//!   2. The `~/.drift/scans/*.json` files the desktop app writes whenever
//!      a scan completes.
//! The HTTP server is the glue: it serves the viewer at `/`, exposes each
//! local scan under the same `/fixtures/scans/...` URL shape the viewer's
//! offline fixture loader expects (so no viewer changes are needed), and
//! adds a documented REST API at `/api/...` + Swagger UI at `/docs` so
//! external tools — and your colleague sitting at another machine — can
//! drive scans without going through Tauri IPC.
//!
//! Cross-computer sharing: `GET /api/scans/{id}/download` returns the raw
//! envelope JSON with a `Content-Disposition: attachment` header (click to
//! save). `POST /api/scans/import` accepts that JSON (or a bare `Report`)
//! on a different machine and stores it under `~/.drift/scans/` with a
//! fresh local id — the viewer index then lights it up automatically.
//!
//! Security: bound to `127.0.0.1` only. The port is configurable via
//! `DRIFT_HTTP_PORT` (default [`DEFAULT_PORT`]). We never bind 0.0.0.0 —
//! this is a desktop-local service.

mod embed;
mod openapi;
mod routes;
mod state;

use std::net::SocketAddr;
use std::sync::{Arc, OnceLock};

use axum::Router;
use tauri::{AppHandle, Runtime};
use tokio_util::sync::CancellationToken;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::{info, warn};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::scan::runner::{PickerRegistry, ScanCancelRegistry};
use crate::scan::suggester::SuggestionRegistry;

pub use state::HttpServerState;

/// Port the server actually bound to. Populated once inside [`serve`]; the
/// `get_http_server_url` Tauri command reads this so the UI can open the
/// real URL even when `DRIFT_HTTP_PORT` overrides [`DEFAULT_PORT`].
/// `None` means the server isn't up yet (UI shows a disabled button).
static BOUND_PORT: OnceLock<u16> = OnceLock::new();

/// Public accessor for the URL the desktop UI can hand to the system
/// browser. `None` until [`serve`] has successfully bound a socket.
pub fn server_url() -> Option<String> {
    BOUND_PORT
        .get()
        .map(|p| format!("http://127.0.0.1:{p}"))
}

/// Default loopback port. `5151` is short, memorable, and outside the
/// typical Vite (5173) / Next (3000) / Vercel-CLI (3001) ranges users have
/// open during development. Overridable via `DRIFT_HTTP_PORT`.
pub const DEFAULT_PORT: u16 = 5151;

/// Resolve the bind port from the `DRIFT_HTTP_PORT` env var or fall back to
/// [`DEFAULT_PORT`]. Invalid values log a warning and use the default.
pub fn resolved_port() -> u16 {
    parse_port(std::env::var("DRIFT_HTTP_PORT").ok().as_deref())
}

/// Pure helper exposed for tests — same parsing logic as `resolved_port`
/// but without touching real environment variables (which race across
/// parallel test threads).
fn parse_port(raw: Option<&str>) -> u16 {
    let Some(s) = raw else { return DEFAULT_PORT };
    s.parse().unwrap_or_else(|_| {
        warn!("DRIFT_HTTP_PORT={s} is not a valid port; using {DEFAULT_PORT}");
        DEFAULT_PORT
    })
}

/// Bind the server and serve forever. Returns only on bind error — typical
/// callers spawn this on `tauri::async_runtime::spawn` so a failure here
/// does not take down the Tauri app.
///
/// The `app_handle`, picker registry, and cancel registry are the same
/// values held in `AppState`. We take `Arc`s so the server can drive scans
/// (start, cancel, picker decision) using the *same* registries the Tauri
/// commands use — both UIs see one shared in-process state.
pub async fn serve<R: Runtime>(
    app_handle: AppHandle<R>,
    scan_pickers: Arc<PickerRegistry>,
    scan_cancels: Arc<ScanCancelRegistry>,
    scan_suggestions: Arc<SuggestionRegistry>,
    port: u16,
    shutdown: CancellationToken,
) -> anyhow::Result<()> {
    let server_state = Arc::new(HttpServerState::new(
        app_handle,
        scan_pickers,
        scan_cancels,
        scan_suggestions,
    ));

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app: Router = Router::new()
        .merge(routes::api_router(Arc::clone(&server_state)))
        // Viewer mounts last so its catch-all `/*path` doesn't shadow `/api/*`.
        .merge(routes::viewer_router())
        .merge(
            SwaggerUi::new("/docs").url("/openapi.json", openapi::ApiDoc::openapi()),
        )
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            warn!("drift-lab HTTP server: failed to bind {addr}: {e}");
            return Err(e.into());
        }
    };
    // Cache the real bound port so the UI can read it back over IPC. The
    // local-addr lookup (rather than reusing `port`) leaves room for a
    // future "bind 0 and pick whatever the OS gives us" mode.
    let actual_port = listener
        .local_addr()
        .map(|a| a.port())
        .unwrap_or(port);
    let _ = BOUND_PORT.set(actual_port);
    info!(
        "drift-lab HTTP server listening on http://127.0.0.1:{} (viewer at /, API docs at /docs)",
        actual_port
    );
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            shutdown.cancelled().await;
            info!("drift-lab HTTP server: shutdown signal received");
        })
        .await
        .map_err(|e| anyhow::anyhow!("axum serve error: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_port_is_5151() {
        // Wire-contract: the "beautiful port" the UI advertises and the
        // backend listens on must agree. Changing this without updating
        // LocalServerLinks would put the button on the wrong URL.
        assert_eq!(DEFAULT_PORT, 5151);
    }

    #[test]
    fn parse_port_uses_default_when_input_missing() {
        assert_eq!(parse_port(None), DEFAULT_PORT);
    }

    #[test]
    fn parse_port_uses_parsed_value_when_valid() {
        assert_eq!(parse_port(Some("6262")), 6262);
    }

    #[test]
    fn parse_port_falls_back_on_garbage_input() {
        assert_eq!(parse_port(Some("not-a-port")), DEFAULT_PORT);
        assert_eq!(parse_port(Some("")), DEFAULT_PORT);
        assert_eq!(parse_port(Some("99999")), DEFAULT_PORT); // out-of-range u16
    }

    #[test]
    fn server_url_is_none_before_bind() {
        // Before any `serve()` call, the OnceLock is empty. Once the
        // server binds, this slot is populated for the rest of the
        // process — so this assertion is only safe as the first test to
        // observe it. Because the test runner doesn't actually call
        // `serve` in unit tests, `None` is the correct expectation.
        // (Cargo test ordering: alphabetical, and no other test sets the
        // lock.)
        assert!(server_url().is_none());
    }
}
