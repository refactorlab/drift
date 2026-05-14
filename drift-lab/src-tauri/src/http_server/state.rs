//! Server-side state passed to every axum handler.
//!
//! Why type-erased: `AppHandle<R>` is generic over `tauri::Runtime`, but
//! axum's `Router::with_state` (and handler bounds in general) want a
//! concrete `'static + Clone + Send + Sync` state. Rather than make every
//! handler generic over `R` — which fights both axum and `utoipa` — we
//! wrap the runtime-parameterised pieces (scan kick-off, event listen /
//! unlisten) behind a `dyn` trait object at server construction.

use std::sync::Arc;

use tauri::{AppHandle, Runtime};

use crate::scan::runner::{PickerRegistry, ScanCancelRegistry};
use crate::scan::suggester::SuggestionRegistry;

/// Adapter trait around the runtime-parameterised side effects we need
/// inside HTTP handlers. The implementation captures an `AppHandle<R>` so
/// the trait itself stays free of generics.
pub trait TauriBridge: Send + Sync {
    /// Kick off a static scan against `project_path`. `scan_id` is the
    /// public handle the API returns; progress events arrive on the Tauri
    /// event bus (and from there, the SSE endpoint).
    fn start_static_scan(
        &self,
        scan_id: String,
        project_path: std::path::PathBuf,
        filters: crate::app_config::ScanFilters,
    );

    /// Subscribe to a Tauri event topic. Callback fires per payload, with
    /// the raw JSON string the emitter sent. Returns the listener id so it
    /// can later be removed.
    fn listen(
        &self,
        topic: &'static str,
        cb: Box<dyn Fn(String) + Send + 'static>,
    ) -> u32;

    /// Remove a previously installed listener.
    fn unlisten(&self, id: u32);
}

pub struct TauriBridgeImpl<R: Runtime> {
    app: AppHandle<R>,
    scan_pickers: Arc<PickerRegistry>,
    scan_cancels: Arc<ScanCancelRegistry>,
}

impl<R: Runtime> TauriBridgeImpl<R> {
    pub fn new(
        app: AppHandle<R>,
        scan_pickers: Arc<PickerRegistry>,
        scan_cancels: Arc<ScanCancelRegistry>,
    ) -> Self {
        Self { app, scan_pickers, scan_cancels }
    }
}

impl<R: Runtime> TauriBridge for TauriBridgeImpl<R> {
    fn start_static_scan(
        &self,
        scan_id: String,
        project_path: std::path::PathBuf,
        filters: crate::app_config::ScanFilters,
    ) {
        crate::scan::runner::start_scan(
            self.app.clone(),
            scan_id,
            project_path,
            filters,
            Arc::clone(&self.scan_pickers),
            Arc::clone(&self.scan_cancels),
        );
    }

    fn listen(
        &self,
        topic: &'static str,
        cb: Box<dyn Fn(String) + Send + 'static>,
    ) -> u32 {
        use tauri::Listener;
        self.app.listen(topic, move |ev| {
            cb(ev.payload().to_string());
        })
    }

    fn unlisten(&self, id: u32) {
        use tauri::Listener;
        self.app.unlisten(id);
    }
}

/// Concrete, non-generic state stored in the axum router.
pub struct HttpServerState {
    pub bridge: Box<dyn TauriBridge>,
    pub scan_pickers: Arc<PickerRegistry>,
    pub scan_cancels: Arc<ScanCancelRegistry>,
    /// Same registry the Tauri command path uses — shared so a DELETE
    /// /api/scans/:id from the viewer cancels any in-flight suggestion
    /// drivers before removing the file (mirrors `delete_static_scan`).
    pub scan_suggestions: Arc<SuggestionRegistry>,
}

impl HttpServerState {
    pub fn new<R: Runtime>(
        app: AppHandle<R>,
        scan_pickers: Arc<PickerRegistry>,
        scan_cancels: Arc<ScanCancelRegistry>,
        scan_suggestions: Arc<SuggestionRegistry>,
    ) -> Self {
        let bridge = TauriBridgeImpl::new(
            app,
            Arc::clone(&scan_pickers),
            Arc::clone(&scan_cancels),
        );
        Self {
            bridge: Box::new(bridge),
            scan_pickers,
            scan_cancels,
            scan_suggestions,
        }
    }
}
