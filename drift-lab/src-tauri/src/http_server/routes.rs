//! HTTP handlers for the localhost server.
//!
//! Two route groups:
//!   - **viewer**: serves the embedded React SPA at `/`, plus an adapter
//!     for the `/fixtures/scans/...` shape the viewer expects so each
//!     `~/.drift/scans/*.json` shows up as a fixture.
//!   - **api**: documented JSON API under `/api/*` (Swagger at `/docs`).
//!
//! Streaming: scan progress is broadcast over an SSE endpoint
//! (`GET /api/scans/:id/stream`). The handler subscribes to Tauri's
//! event bus (`scan://progress`, `scan://complete`, `scan://error`,
//! `scan://entries-ready`) and forwards anything tagged with the matching
//! `scanId`. The Tauri commands keep emitting unchanged — the SSE handler
//! is a passive observer, not a parallel pipeline.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::{header, StatusCode};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use futures_util::stream::Stream;
use serde::{Deserialize, Serialize};
use tokio_stream::wrappers::UnboundedReceiverStream;
use tokio_stream::StreamExt;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::app_config::ScanFilters;
use crate::scan::runner;
use crate::scan::storage::{self, ScanMeta, StoredScan};
use crate::scan::suggester::{self, FindingItem};
use crate::scan::types::ScanPickerRoot;

use super::embed::ViewerAssets;
use super::state::HttpServerState;

// ---------- Router assembly --------------------------------------------------

/// Routes under `/api/...`. Carry the shared [`HttpServerState`] so each
/// handler can reach the bridge + scan registries.
pub fn api_router(state: Arc<HttpServerState>) -> Router {
    Router::new()
        .route("/api/health", get(api_health))
        .route("/api/scans", get(api_list_scans).post(api_start_scan))
        // Cross-machine scan sharing — see `api_import_scan` doc-comment.
        // `import` is intentionally registered BEFORE `:id` so axum's
        // matcher routes /api/scans/import to import (not to a scan whose
        // id is literally "import").
        .route("/api/scans/import", post(api_import_scan))
        .route("/api/scans/:id", get(api_get_scan).delete(api_delete_scan))
        .route("/api/scans/:id/download", get(api_download_scan))
        .route("/api/scans/:id/entries", get(api_list_scan_entries))
        .route("/api/scans/:id/findings", get(api_list_scan_findings))
        .route("/api/scans/:id/stop", post(api_stop_scan))
        .route("/api/scans/:id/pick", post(api_pick_entry))
        .route("/api/scans/:id/stream", get(api_scan_stream))
        .with_state(state)
}

/// Routes for the viewer SPA and its fixture-shape adapter.
///
/// The viewer's `userScans.ts` fetches `/fixtures/scans/index.json` once,
/// then each scan JSON at `/fixtures/scans/<key>.json`. We respond to those
/// URLs with content derived from `~/.drift/scans/*.json` so the existing
/// viewer "just works" without any code change on its side.
pub fn viewer_router() -> Router {
    Router::new()
        .route("/", get(serve_index))
        .route("/index.html", get(serve_index))
        .route("/fixtures/scans/index.json", get(viewer_scan_index))
        .route("/fixtures/scans/:name", get(viewer_scan_file))
        // Catch-all for assets (Vite emits hashed names under /assets/*).
        .route("/*path", get(serve_asset))
}

// ---------- Wire types -------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Health {
    pub status: String,
    pub version: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScanMetaDto {
    pub scan_id: String,
    pub saved_at: String,
    pub source_root: Option<String>,
    pub profiled_language: Option<String>,
    pub files: u32,
    pub symbols: u32,
    pub findings_total: u32,
}

impl From<ScanMeta> for ScanMetaDto {
    fn from(m: ScanMeta) -> Self {
        Self {
            scan_id: m.scan_id,
            saved_at: m.saved_at,
            source_root: m.source_root,
            profiled_language: m.profiled_language,
            files: m.files,
            symbols: m.symbols,
            findings_total: m.findings_total,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StartScanBody {
    /// Absolute path to the project root the static profiler should scan.
    pub project_path: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StartScanReply {
    pub scan_id: String,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PickEntryBody {
    /// Index into the picker-root list returned via `scan://entries-ready`.
    /// `null` cancels the scan cleanly.
    pub root_index: Option<usize>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ApiError {
    pub error: String,
}

fn err(status: StatusCode, msg: impl Into<String>) -> Response {
    (status, Json(ApiError { error: msg.into() })).into_response()
}

// ---------- API handlers -----------------------------------------------------

/// Health probe — useful for the UI to detect the local server is reachable.
#[utoipa::path(
    get,
    path = "/api/health",
    tag = "system",
    responses((status = 200, body = Health))
)]
pub async fn api_health() -> Json<Health> {
    Json(Health {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// List every scan persisted under `~/.drift/scans/`. Sorted newest first.
#[utoipa::path(
    get,
    path = "/api/scans",
    tag = "scans",
    responses(
        (status = 200, body = Vec<ScanMetaDto>),
        (status = 500, body = ApiError),
    )
)]
pub async fn api_list_scans() -> Response {
    match storage::list_scans() {
        Ok(scans) => {
            let dto: Vec<ScanMetaDto> = scans.into_iter().map(ScanMetaDto::from).collect();
            Json(dto).into_response()
        }
        Err(e) => err(StatusCode::INTERNAL_SERVER_ERROR, format!("{e:#}")),
    }
}

/// Return the full saved envelope (scan_id + saved_at + Report + picker_roots).
#[utoipa::path(
    get,
    path = "/api/scans/{id}",
    tag = "scans",
    params(("id" = String, Path, description = "Scan UUID")),
    responses(
        (status = 200, body = serde_json::Value),
        (status = 404, body = ApiError),
    )
)]
pub async fn api_get_scan(Path(id): Path<String>) -> Response {
    match storage::load_envelope(&id) {
        Ok(stored) => Json(stored).into_response(),
        Err(e) => err(StatusCode::NOT_FOUND, format!("{e:#}")),
    }
}

/// Delete a saved scan from `~/.drift/scans/`. Idempotent — returns 204
/// whether the scan existed or not. The viewer at `/` invokes this from
/// its per-card delete button; the desktop UI uses the Tauri IPC
/// equivalent (`delete_static_scan`).
///
/// Any in-flight per-finding suggestion driver for this scan is
/// cancelled before the file is removed so it can't recreate the
/// envelope mid-delete. Path-traversal-safe via `storage::scan_path`.
#[utoipa::path(
    delete,
    path = "/api/scans/{id}",
    tag = "scans",
    params(("id" = String, Path, description = "Scan UUID")),
    responses(
        (status = 204, description = "Scan deleted (or did not exist)"),
        (status = 400, body = ApiError, description = "Invalid scan id"),
    )
)]
pub async fn api_delete_scan(
    State(state): State<Arc<HttpServerState>>,
    Path(id): Path<String>,
) -> Response {
    // Match the Tauri command's safety order: cancel any in-flight
    // suggestion drivers writing to this scan first.
    state.scan_suggestions.cancel_all_for_scan(&id);
    match storage::delete_scan(&id) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => err(StatusCode::BAD_REQUEST, format!("{e:#}")),
    }
}

/// Return the picker-style root list (index, name, file, line, callers).
#[utoipa::path(
    get,
    path = "/api/scans/{id}/entries",
    tag = "scans",
    params(("id" = String, Path, description = "Scan UUID")),
    responses(
        (status = 200, body = serde_json::Value),
        (status = 404, body = ApiError),
    )
)]
pub async fn api_list_scan_entries(Path(id): Path<String>) -> Response {
    let env = match storage::load_envelope(&id) {
        Ok(s) => s,
        Err(e) => return err(StatusCode::NOT_FOUND, format!("{e:#}")),
    };
    let rows: Vec<ScanPickerRoot> = env
        .report
        .entries
        .iter()
        .enumerate()
        .map(|(i, e)| ScanPickerRoot {
            index: i,
            name: e.name.clone(),
            file: e.file.clone(),
            line: e.line,
            reach: e.subtree_size,
            callers: e
                .callers
                .iter()
                .map(|c| crate::scan::types::ScanPickerCaller {
                    name: c.name.clone(),
                    file: c.file.clone(),
                    line: c.line,
                })
                .collect(),
        })
        .collect();
    Json(rows).into_response()
}

/// Canonical ranked + deduped finding list for a saved scan.
#[utoipa::path(
    get,
    path = "/api/scans/{id}/findings",
    tag = "scans",
    params(("id" = String, Path, description = "Scan UUID")),
    responses(
        (status = 200, body = serde_json::Value),
        (status = 404, body = ApiError),
    )
)]
pub async fn api_list_scan_findings(Path(id): Path<String>) -> Response {
    let env = match storage::load_envelope(&id) {
        Ok(s) => s,
        Err(e) => return err(StatusCode::NOT_FOUND, format!("{e:#}")),
    };
    let items: Vec<FindingItem> = suggester::collect_findings(&env.report);
    Json(items).into_response()
}

/// Kick off a new static scan. Returns the freshly-generated `scan_id`;
/// progress is observable via `GET /api/scans/{id}/stream` or by polling
/// `GET /api/scans/{id}` once the scan completes.
#[utoipa::path(
    post,
    path = "/api/scans",
    tag = "scans",
    request_body = StartScanBody,
    responses(
        (status = 200, body = StartScanReply),
        (status = 400, body = ApiError),
    )
)]
pub async fn api_start_scan(
    State(state): State<Arc<HttpServerState>>,
    Json(body): Json<StartScanBody>,
) -> Response {
    let path = PathBuf::from(&body.project_path);
    if !path.is_dir() {
        return err(
            StatusCode::BAD_REQUEST,
            format!("not a directory: {}", body.project_path),
        );
    }
    let scan_id = Uuid::new_v4().to_string();
    // Use default filters — the HTTP API is meant for programmatic clients
    // that haven't opened the desktop settings UI. Future revs can accept
    // overrides in the request body.
    let filters = ScanFilters::default();
    state
        .bridge
        .start_static_scan(scan_id.clone(), path, filters);
    Json(StartScanReply { scan_id }).into_response()
}

/// Stop an in-flight scan. Idempotent — returns `false` if no scan is
/// running with that id.
#[utoipa::path(
    post,
    path = "/api/scans/{id}/stop",
    tag = "scans",
    params(("id" = String, Path, description = "Scan UUID")),
    responses((status = 200, body = bool))
)]
pub async fn api_stop_scan(
    State(state): State<Arc<HttpServerState>>,
    Path(id): Path<String>,
) -> Json<bool> {
    Json(runner::stop_scan(
        &id,
        state.scan_pickers.as_ref(),
        state.scan_cancels.as_ref(),
    ))
}

/// Deliver the user's picker choice for a parked scan.
#[utoipa::path(
    post,
    path = "/api/scans/{id}/pick",
    tag = "scans",
    params(("id" = String, Path, description = "Scan UUID")),
    request_body = PickEntryBody,
    responses(
        (status = 200, body = serde_json::Value),
        (status = 400, body = ApiError),
    )
)]
pub async fn api_pick_entry(
    State(state): State<Arc<HttpServerState>>,
    Path(id): Path<String>,
    Json(body): Json<PickEntryBody>,
) -> Response {
    match state.scan_pickers.decide(&id, body.root_index) {
        Ok(()) => Json(serde_json::json!({ "ok": true })).into_response(),
        Err(e) => err(StatusCode::BAD_REQUEST, format!("{e:#}")),
    }
}

/// Server-Sent Events stream of every Tauri event tagged for `scan_id`.
///
/// Why SSE (not WebSocket): SSE is unidirectional, trivially served over
/// HTTP/1.1 or HTTP/2, requires no custom framing on the client, and the
/// `EventSource` API is built into every browser. The scan workflow is
/// server-push-only — there is no need for the bidirectional channel a
/// WebSocket would buy us.
///
/// The handler subscribes to the four scan topics via the bridge, filters
/// by the scan_id embedded in each payload, and forwards matching events
/// as SSE. Listeners are released when the stream drops so we don't leak
/// handlers per disconnected client.
#[utoipa::path(
    get,
    path = "/api/scans/{id}/stream",
    tag = "scans",
    params(("id" = String, Path, description = "Scan UUID")),
    responses(
        (status = 200, description = "text/event-stream of scan progress events")
    )
)]
pub async fn api_scan_stream(
    State(state): State<Arc<HttpServerState>>,
    Path(id): Path<String>,
) -> Sse<impl Stream<Item = Result<Event, axum::Error>>> {
    use crate::scan::types::topic;

    let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<Event>();
    let want_id = id;

    let topics: [&'static str; 4] = [
        topic::PROGRESS,
        topic::ENTRIES_READY,
        topic::COMPLETE,
        topic::ERROR,
    ];

    let mut listener_ids: Vec<u32> = Vec::with_capacity(topics.len());
    for ev_name in topics {
        let tx2 = tx.clone();
        let want = want_id.clone();
        let name = ev_name.to_string();
        let id = state.bridge.listen(
            ev_name,
            Box::new(move |payload: String| {
                // Tauri events carry the payload as a JSON string. We re-parse
                // it cheaply and filter on scanId so each SSE client only sees
                // its own scan.
                let Ok(value): Result<serde_json::Value, _> = serde_json::from_str(&payload)
                else {
                    return;
                };
                let matches = value
                    .get("scanId")
                    .and_then(|v| v.as_str())
                    .map(|s| s == want)
                    .unwrap_or(false);
                if !matches {
                    return;
                }
                let _ = tx2.send(Event::default().event(name.clone()).data(payload));
            }),
        );
        listener_ids.push(id);
    }

    // Guard that releases every listener when dropped. We hold it inside
    // the stream so it lives exactly as long as the SSE connection.
    struct UnlistenGuard {
        state: Arc<HttpServerState>,
        ids: Vec<u32>,
    }
    impl Drop for UnlistenGuard {
        fn drop(&mut self) {
            for id in self.ids.drain(..) {
                self.state.bridge.unlisten(id);
            }
        }
    }
    let guard = UnlistenGuard {
        state: Arc::clone(&state),
        ids: listener_ids,
    };

    // The guard is captured into the stream's terminal step so it survives
    // until the receiver naturally ends (client disconnect drops `tx` once
    // every clone is gone — for our purposes, the keep-alive prevents
    // hung-up sockets and `unlisten` runs when the connection closes).
    let stream = UnboundedReceiverStream::new(rx)
        .map(Ok)
        .chain(futures_util::stream::once(async move {
            drop(guard);
            Ok(Event::default().event("end").data("{}"))
        }));

    Sse::new(stream).keep_alive(KeepAlive::new().interval(Duration::from_secs(15)))
}

// ---------- Viewer / static asset handlers ----------------------------------

async fn serve_index() -> Response {
    serve_embedded_path("index.html").await
}

async fn serve_asset(Path(path): Path<String>) -> Response {
    // SPA fallback: anything that isn't an embedded asset returns
    // index.html so React Router can take over.
    if ViewerAssets::get(&path).is_some() {
        serve_embedded_path(&path).await
    } else {
        serve_embedded_path("index.html").await
    }
}

async fn serve_embedded_path(path: &str) -> Response {
    let Some(asset) = ViewerAssets::get(path) else {
        return (StatusCode::NOT_FOUND, "not found").into_response();
    };
    let mime = mime_guess::from_path(path).first_or_octet_stream();
    Response::builder()
        .header(header::CONTENT_TYPE, mime.as_ref())
        .body(Body::from(asset.data.into_owned()))
        .unwrap_or_else(|_| (StatusCode::INTERNAL_SERVER_ERROR, "body error").into_response())
}

/// Viewer-shape index of local scans. Mirrors the `FixtureSpec[]` JSON the
/// viewer fetches from `/fixtures/scans/index.json` in its file-based
/// fixture mode — the viewer doesn't need to know it's talking to a real
/// server. One row per scan in `~/.drift/scans/`.
#[derive(Debug, Serialize)]
struct ViewerFixtureSpec {
    key: String,
    label: String,
    json: String,
    description: String,
}

async fn viewer_scan_index() -> Response {
    let scans = match storage::list_scans() {
        Ok(s) => s,
        Err(e) => {
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("listing scans: {e:#}"),
            )
        }
    };
    let rows: Vec<ViewerFixtureSpec> = scans
        .into_iter()
        .map(|m| ViewerFixtureSpec {
            key: m.scan_id.clone(),
            label: scan_label(&m),
            json: format!("/fixtures/scans/{}.json", m.scan_id),
            description: m
                .source_root
                .clone()
                .unwrap_or_else(|| format!("saved {}", m.saved_at)),
        })
        .collect();
    Json(rows).into_response()
}

fn scan_label(m: &ScanMeta) -> String {
    if let Some(root) = &m.source_root {
        if let Some(name) = std::path::Path::new(root).file_name().and_then(|s| s.to_str()) {
            return name.to_string();
        }
    }
    m.scan_id.clone()
}

/// Return the inner `Report` from a stored scan envelope — the viewer's
/// `loadFixture()` expects the bare report shape, not the envelope, so we
/// strip the wrapper here.
async fn viewer_scan_file(Path(name): Path<String>) -> Response {
    let scan_id = match name.strip_suffix(".json") {
        Some(s) => s.to_string(),
        None => return err(StatusCode::NOT_FOUND, format!("not a scan file: {name}")),
    };
    let stored: StoredScan = match storage::load_envelope(&scan_id) {
        Ok(s) => s,
        Err(e) => return err(StatusCode::NOT_FOUND, format!("{e:#}")),
    };
    Json(stored.report).into_response()
}

// ---------- Cross-machine scan sharing --------------------------------------

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ImportScanReply {
    /// The fresh local id under which the imported scan was stored.
    /// **Not** the same as the source machine's id — we always mint a new
    /// UUID on import so a repeated import never clobbers an existing
    /// local scan.
    pub scan_id: String,
}

/// Download the raw `~/.drift/scans/{id}.json` with a `Content-Disposition`
/// header so a browser click yields a file the user can hand to a
/// colleague. The colleague POSTs it to `/api/scans/import` on their own
/// machine; it lights up automatically in the viewer at `/`.
#[utoipa::path(
    get,
    path = "/api/scans/{id}/download",
    tag = "scans",
    params(("id" = String, Path, description = "Scan UUID")),
    responses(
        (status = 200, description = "Raw stored scan JSON (envelope shape)"),
        (status = 404, body = ApiError),
    )
)]
pub async fn api_download_scan(Path(id): Path<String>) -> Response {
    let stored: StoredScan = match storage::load_envelope(&id) {
        Ok(s) => s,
        Err(e) => return err(StatusCode::NOT_FOUND, format!("{e:#}")),
    };
    let bytes = match serde_json::to_vec_pretty(&stored) {
        Ok(b) => b,
        Err(e) => {
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("serializing scan: {e}"),
            );
        }
    };
    let filename = format!("drift-scan-{id}.json");
    Response::builder()
        .header(header::CONTENT_TYPE, "application/json")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{filename}\""),
        )
        .body(Body::from(bytes))
        .unwrap_or_else(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "body error"))
}

/// Import a scan JSON from another machine. Accepts either the envelope
/// shape that `GET /api/scans/{id}/download` emits **or** a bare `Report`
/// body (so a `drift-static-profiler` CLI result can be imported too).
/// Returns the freshly-minted local id; the viewer at `/` picks it up
/// without a refresh because `userScans.ts` re-fetches the index on every
/// mount.
///
/// Why mint a fresh id on import: the source machine's UUID is meaningless
/// here, and reusing it risks overwriting an existing local scan that the
/// recipient already has. The source id is preserved inside the envelope
/// (`scan_id` field) for audit but it is not the on-disk filename.
#[utoipa::path(
    post,
    path = "/api/scans/import",
    tag = "scans",
    request_body(
        description = "Either a full envelope (preferred) or a bare Report.",
        content_type = "application/json",
    ),
    responses(
        (status = 200, body = ImportScanReply),
        (status = 400, body = ApiError),
    )
)]
pub async fn api_import_scan(body: axum::body::Bytes) -> Response {
    // Try parsing the envelope first; on failure, try the bare Report.
    // Keeping the raw bytes around means a Report-shaped POST gets a clean
    // second-pass parse instead of a stale half-deserialised envelope.
    let (report, picker_roots) = if let Ok(env) =
        serde_json::from_slice::<StoredScan>(&body)
    {
        (env.report, env.picker_roots)
    } else {
        match serde_json::from_slice::<drift_static_profiler::report::Report>(&body) {
            Ok(r) => (r, Vec::new()),
            Err(e) => {
                return err(
                    StatusCode::BAD_REQUEST,
                    format!("body is neither a scan envelope nor a Report: {e}"),
                );
            }
        }
    };

    let scan_id = Uuid::new_v4().to_string();
    if let Err(e) = storage::save_report(&scan_id, &report, &picker_roots) {
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("saving imported scan: {e:#}"),
        );
    }
    Json(ImportScanReply { scan_id }).into_response()
}
