//! Utoipa-driven OpenAPI document for the `/api/*` surface.
//!
//! Each handler in `routes.rs` carries a `#[utoipa::path(...)]` annotation;
//! we list them all here in `paths(...)` to assemble the final
//! `ApiDoc::openapi()` value that Swagger UI renders at `/docs`.

use utoipa::OpenApi;

use super::routes;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "drift-lab local API",
        version = "0.1.0",
        description = "Localhost HTTP API exposed by the drift-lab desktop app. \
                       Drives static scans of source trees and surfaces every \
                       scan saved under `~/.drift/scans/`. Bound to 127.0.0.1 only.",
    ),
    paths(
        routes::api_health,
        routes::api_list_scans,
        routes::api_get_scan,
        routes::api_get_scan_summary,
        routes::api_get_scan_entry,
        routes::api_delete_scan,
        routes::api_download_scan,
        routes::api_import_scan,
        routes::api_list_scan_entries,
        routes::api_list_scan_findings,
        routes::api_start_scan,
        routes::api_stop_scan,
        routes::api_pick_entry,
        routes::api_scan_stream,
    ),
    tags(
        (name = "scans", description = "Static-profiler scan lifecycle and storage"),
        (name = "system", description = "Health + version info"),
    )
)]
pub struct ApiDoc;
