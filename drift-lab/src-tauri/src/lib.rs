#[allow(dead_code)] // Public API surface — callers (tests, future commands) opt in over time.
pub mod agent;
mod agent_tools;
mod app_config;
mod backend;
/// CLI installer subsystem — bundles the `drift` CLI inside the desktop
/// release and puts it on the user's PATH at first launch.
#[allow(dead_code)] // Outer rings opt in as they land.
pub mod cli_install;
mod commands;
mod db;
mod docker;
pub mod event_log;
mod event_log_commands;
mod event_log_to_profile;
mod event_source_commands;
/// Folder identity + registry. Both static scans and active realtime
/// sessions are scoped to a `FolderFingerprint` so the two paths can
/// be joined later. See `folder/mod.rs` for the rationale.
pub mod folder;
mod folder_commands;
#[allow(dead_code)] // `JoinSuggestion::is_joined` + alternatives helpers — kept for upcoming UI surface.
mod fuzzy_join;
/// Loads a saved static scan into the flat `StaticNode` shape that
/// `fuzzy_join` consumes when correlating live sampled frames against
/// previously-scanned code. See module docs.
mod static_scan_index;
/// Infers a container→host path mapping from the union of live and
/// static file paths so Docker frames join at high confidence
/// instead of falling back to Tier-7 basename matching.
mod path_alias;
/// Tauri command surface for the live ↔ static join. Wires the live
/// aggregator's per-function rollup into `fuzzy_join` and projects
/// the matcher output into a UI-friendly report.
mod join_commands;
pub mod events;
mod history;
mod http_server;
/// Process-wide broadcast for tracing log lines. The tracing layer
/// publishes once; the UI's Tauri-emit task and the SSE `/api/logs/stream`
/// handler subscribe independently. Keeps fan-out logic in one place.
pub mod log_bus;
mod model_config;
pub mod model_discovery;
mod presets;
pub mod patch;
/// Supabase Realtime subsystem — domain / ports / adapters / use cases.
/// The Tauri command shims that drive it live in `event_source_commands.rs`
/// and `commands.rs`; everything in here is testable without a tauri
/// runtime in sight.
pub mod realtime;
pub mod scan;
mod scan_commands;
/// Phase-A onwards: actively used. The trait stays public so a future
/// `KeychainSecretStore` can replace `FileSecretStore` without touching
/// commands or UI.
mod secret_store;
mod shutdown;
mod state;
mod telemetry;
mod user_input;
#[allow(dead_code)] // Each tool is independently callable by the LLM; not all are wired into workflow.rs yet.
pub mod tools;
mod tray;
mod workflow;

use std::sync::Arc;

use tauri::{Emitter, Manager};
use tracing::info;

use crate::events::LogLine;

/// Initialise a `tracing` subscriber that writes formatted lines to stderr
/// *and* mirrors them to the UI via [`register_log_emitter`].
///
/// `RUST_LOG` controls the filter (default `info,drift=debug` so the agent /
/// tools / workflow log lines all show up while we keep external crates
/// quiet). Note: this also installs a global `log` logger via `tracing-log`,
/// which is why we don't register `tauri-plugin-log` — both would race to set
/// the global `log::set_logger` and the second one panics.
fn init_tracing() {
    use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
    // The bus must be live before TauriEventLayer fires its first event;
    // publish() is a silent no-op until init() runs. Ordering matters:
    // installing the layer below first would lose any event emitted
    // between subscriber-init and bus-init.
    log_bus::init();
    // EnvFilter target matching is module-prefix with `::` separators —
    // so `drift=debug` does NOT match `drift_static_profiler` (underscore
    // is not a `::`). List the profiler explicitly so its per-phase
    // `tracing::info!` lines surface alongside the desktop's own
    // `drift_lab_lib=debug` events.
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        EnvFilter::new("info,drift=debug,drift_lab_lib=debug,drift_static_profiler=debug")
    });
    let stderr_layer = fmt::layer()
        .with_target(true)
        .with_writer(std::io::stderr)
        .compact();
    let _ = tracing_subscriber::registry()
        .with(filter)
        .with(stderr_layer)
        .with(TauriEventLayer)
        .try_init();
}

/// `tracing_subscriber::Layer` that forwards each filtered event to the
/// registered emitter. No-op until the emitter is installed (which happens
/// inside the Tauri `setup()` once an `AppHandle` is available).
struct TauriEventLayer;

impl<S> tracing_subscriber::Layer<S> for TauriEventLayer
where
    S: tracing::Subscriber,
{
    fn on_event(
        &self,
        event: &tracing::Event<'_>,
        _ctx: tracing_subscriber::layer::Context<'_, S>,
    ) {
        let meta = event.metadata();
        let mut visitor = MessageVisitor::default();
        event.record(&mut visitor);
        let line = LogLine {
            ts_ms: chrono::Utc::now().timestamp_millis(),
            level: meta.level().to_string(),
            target: meta.target().to_string(),
            message: visitor.into_string(),
        };
        log_bus::publish(line);
    }
}

/// Field visitor that pulls out the `message` plus any `k=v` extras a
/// `tracing::info!` invocation attached. We strip the surrounding quotes
/// that `Debug` adds around string-like fields so the UI doesn't show
/// `"scan workflow starting"` with literal quotes.
#[derive(Default)]
struct MessageVisitor {
    message: String,
    fields: Vec<(String, String)>,
}

impl MessageVisitor {
    fn into_string(self) -> String {
        let MessageVisitor {
            mut message,
            fields,
        } = self;
        if fields.is_empty() {
            return message;
        }
        if !message.is_empty() {
            message.push_str("  ");
        }
        for (i, (k, v)) in fields.iter().enumerate() {
            if i > 0 {
                message.push(' ');
            }
            use std::fmt::Write as _;
            let _ = write!(message, "{k}={v}");
        }
        message
    }

    fn strip_debug_quotes(s: String) -> String {
        if s.len() >= 2 && s.starts_with('"') && s.ends_with('"') {
            s[1..s.len() - 1].to_string()
        } else {
            s
        }
    }
}

impl tracing::field::Visit for MessageVisitor {
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        let raw = format!("{value:?}");
        let cleaned = Self::strip_debug_quotes(raw);
        if field.name() == "message" {
            self.message = cleaned;
        } else {
            self.fields.push((field.name().to_string(), cleaned));
        }
    }
    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        if field.name() == "message" {
            self.message = value.to_string();
        } else {
            self.fields.push((field.name().to_string(), value.to_string()));
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_tracing();
    // Install the rustls CryptoProvider before ANY WSS connect runs.
    // Without this, the first realtime test / subscribe panics in
    // tokio_tungstenite and Tauri swallows the error — Test Connection
    // "just does nothing" and the user blames the UI. Eager install at
    // process boot means every downstream TLS user (transport, future
    // reqwest clients, etc.) sees the same provider with no ordering
    // hazard.
    if let Err(e) = realtime::init() {
        tracing::error!("realtime init failed: {e}");
    }
    let mut builder = tauri::Builder::default()
        .manage(state::AppState::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build());

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    builder
        .setup(|app| {
            // Set up tray icon (best-effort; fails silently in headless test envs).
            // Record success in AppState so the window-close handler can fall
            // back to a real exit on Linux desktops without a status-notifier
            // host — otherwise the app would hide with no way to bring it back.
            match tray::install(app.handle()) {
                Ok(()) => {
                    let state: tauri::State<'_, state::AppState> = app.state();
                    state
                        .tray_available
                        .store(true, std::sync::atomic::Ordering::SeqCst);
                }
                Err(e) => tracing::warn!("tray install failed: {e}"),
            }

            // Route POSIX signals (SIGINT from `make dev` Ctrl+C, SIGTERM
            // from `kill` / IDE Stop buttons) and the Windows ctrl-c event
            // through the same graceful-shutdown path as Cmd+Q. Without
            // this, Ctrl+C in the dev terminal hard-kills the binary and
            // skips the HTTP-server drain / SQLite WAL flush /
            // docker-child cleanup. Double-press escape hatch is built in.
            shutdown::install_signal_handlers(app.handle());

            // First-launch CLI installer: symlink the bundled `drift`
            // binary onto the user's PATH so `drift --help` works in any
            // new terminal. Skipped in debug builds (don't pollute
            // developer paths with `make dev` symlinks) and treated as
            // non-fatal — install failures must not block app startup.
            if !cfg!(debug_assertions) {
                let handle_for_cli = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    match cli_install::infra::platform_installer() {
                        Ok(installer) => {
                            let source = match handle_for_cli
                                .path()
                                .resolve("drift", tauri::path::BaseDirectory::Resource)
                            {
                                Ok(p) => p,
                                Err(e) => {
                                    tracing::warn!("cli install: bundle resource lookup failed: {e}");
                                    return;
                                }
                            };
                            match cli_install::app::ensure_installed::execute(&*installer, &source) {
                                Ok(outcome) => tracing::info!(?outcome, "drift CLI install"),
                                Err(e) => tracing::warn!("drift CLI install failed: {e}"),
                            }
                        }
                        Err(e) => tracing::warn!("cli installer init failed: {e}"),
                    }
                });
            }

            // Hook the tracing pipeline into Tauri's event bus so the UI's
            // BackendLogPane can mirror what's printed to stderr. We
            // subscribe to `log_bus` here (not in `init_tracing`) so tests
            // and CLI launches that never build an AppHandle keep getting
            // the stderr-only behaviour.
            let handle_for_log = app.handle().clone();
            if let Some(mut rx) = log_bus::subscribe() {
                tauri::async_runtime::spawn(async move {
                    loop {
                        match log_bus::classify(rx.recv().await) {
                            log_bus::SubscribeOutcome::Line(line) => {
                                let _ = handle_for_log.emit(events::topic::LOG, line);
                            }
                            // Drop notice; the UI doesn't have a "skipped"
                            // marker today and the SSE consumers handle it
                            // separately. Surface to stderr at most so a
                            // pathological flood is visible to operators.
                            log_bus::SubscribeOutcome::Lagged(n) => {
                                tracing::warn!(dropped = n, "UI log subscriber lagged");
                            }
                            log_bus::SubscribeOutcome::Closed => break,
                        }
                    }
                });
            }

            // Bridge the `ask_user` tool to the BlockedModal: the tool parks
            // a oneshot and emits a question; this callback forwards the
            // question payload over Tauri so the UI can render the modal.
            let handle_for_blocked = app.handle().clone();
            user_input::register_emitter(move |q| {
                let _ = handle_for_blocked.emit(events::topic::BLOCKED, q);
            });

            info!("drift-lab ready");

            // Open the SQLite app store (runtime_cache + future tables).
            let handle_for_db = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = db::init(&handle_for_db).await {
                    tracing::warn!("sqlite init failed (non-fatal): {e:?}");
                }
            });

            // Localhost HTTP server: serves the static-profiler viewer at
            // `/`, exposes scans under `~/.drift/scans/` as fixtures the
            // viewer can render, and a documented REST API at `/api/*`
            // (Swagger UI at `/docs`). Bound to 127.0.0.1 only. Failure to
            // bind is non-fatal — the desktop UI keeps working over IPC.
            let handle_for_http = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let port = http_server::resolved_port();
                let state: tauri::State<'_, state::AppState> = handle_for_http.state();
                let scan_pickers = Arc::clone(&state.scan_pickers);
                let scan_cancels = Arc::clone(&state.scan_cancels);
                let scan_suggestions = Arc::clone(&state.scan_suggestions);
                // Share the process-wide shutdown token. `crate::shutdown::run`
                // fires it from the tray "Quit" path and from the
                // `ExitRequested` run-event, so `axum::serve` breaks out of
                // `with_graceful_shutdown` and the bound port is freed before
                // the process exits.
                let shutdown = state.shutdown.clone();
                if let Err(e) = http_server::serve(
                    handle_for_http.clone(),
                    scan_pickers,
                    scan_cancels,
                    scan_suggestions,
                    port,
                    shutdown,
                )
                .await
                {
                    tracing::warn!("drift-lab HTTP server stopped: {e:?}");
                }
            });

            // Hydrate persisted LLM backend config + eager-resolve the active
            // provider in the background so chat is hot when the UI gets there.
            let handle_for_hydrate = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let state: tauri::State<'_, state::AppState> = handle_for_hydrate.state();
                commands::hydrate_app_config_on_startup(&handle_for_hydrate, &state).await;

                let active = {
                    let cfg = state.app_config.lock().await;
                    cfg.active_provider_id
                        .as_ref()
                        .and_then(|id| cfg.providers.iter().find(|p| &p.id == id).cloned())
                };
                if let Some(provider) = active {
                    let (mode, model_label) = match &provider.config {
                        model_config::ModelBackend::Api { model, .. } => {
                            ("api".to_string(), model.clone())
                        }
                        model_config::ModelBackend::Anthropic { model, .. } => {
                            ("anthropic".to_string(), model.clone())
                        }
                    };

                    match backend::resolve(provider.config, &handle_for_hydrate).await {
                        Ok(resolved) => {
                            *state.backend.lock().await = Some(resolved);
                            commands::set_status(
                                &handle_for_hydrate,
                                &state,
                                events::BackendStatus::Ready {
                                    mode,
                                    model: model_label,
                                },
                            )
                            .await;
                            tracing::info!("active provider `{}` resolved", provider.name);
                        }
                        Err(e) => {
                            tracing::warn!("eager backend resolve failed: {e:?}");
                            commands::set_status(
                                &handle_for_hydrate,
                                &state,
                                events::BackendStatus::Error {
                                    message: e.to_string(),
                                },
                            )
                            .await;
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_run,
            commands::cancel_run,
            commands::answer_blocked_question,
            // Single-provider (legacy) — kept for the existing Settings UI.
            commands::configure_backend,
            commands::save_backend_config,
            commands::load_backend_config,
            commands::clear_backend,
            commands::get_backend_status,
            commands::get_http_server_url,
            // Multi-provider (Phase 1.5).
            commands::get_app_config,
            commands::update_scan_filters,
            commands::test_provider,
            commands::save_provider,
            commands::activate_provider,
            commands::delete_provider,
            commands::reset_all_config,
            // Curated provider catalog.
            presets::list_presets,
            // Live discovery: probe local runtimes + endpoint /v1/models probe.
            model_discovery::probe_local_runtimes,
            model_discovery::cached_local_runtimes,
            model_discovery::list_models_from_endpoint,
            // Chat.
            commands::chat,
            commands::chat_oneshot,
            commands::cancel_chat,
            // Iterative agent loop (goose-style).
            commands::agent_chat,
            commands::start_agent_run,
            commands::list_prompt_presets,
            // Conversation history (Phase 3).
            commands::list_conversations,
            commands::load_conversation,
            commands::new_conversation,
            commands::delete_conversation,
            commands::get_current_conversation,
            // Static scan — two-step pick flow + per-finding "Study this" driver.
            scan_commands::start_static_scan,
            scan_commands::restart_scan_from_cache,
            scan_commands::select_entry_and_scan,
            scan_commands::list_static_scans,
            scan_commands::load_static_scan,
            scan_commands::load_static_scan_summary,
            scan_commands::load_scan_entry,
            scan_commands::delete_static_scan,
            scan_commands::list_scan_entries,
            scan_commands::list_scan_findings,
            scan_commands::list_saved_suggestions,
            scan_commands::list_suggestion_versions,
            scan_commands::start_scan_finding_suggestion,
            scan_commands::stop_scan_finding_suggestion,
            scan_commands::stop_static_scan,
            // LLM-driven single-location patch (streaming → card → apply).
            patch::commands::start_patch,
            patch::commands::apply_patch,
            // events.log JSONL aggregator — snakeviz-style profiling view.
            event_log_commands::list_event_logs,
            event_log_commands::delete_event_log,
            event_log_commands::aggregate_event_log,
            event_log_commands::start_live_event_scan,
            event_log_commands::stop_live_event_scan,
            event_log_commands::download_event_log,
            event_log_commands::export_static_profile_json,
            // Secrets (write-only from the renderer; presence-check only).
            commands::set_secret,
            commands::secret_status,
            // Folder registry — folders are the unit of "what's been
            // scanned" and both static + active scans are scoped to
            // them. See `folder/mod.rs`.
            folder_commands::list_scanned_folders,
            folder_commands::register_folder,
            folder_commands::folder_has_static_scan,
            folder_commands::list_static_scans_for_folder,
            join_commands::compute_join_for_active_scan,
            // Realtime config + connection test (one unified, cancellable
            // command for both Settings and Active Scan).
            commands::update_realtime_config,
            event_source_commands::test_realtime_connection,
            event_source_commands::cancel_realtime_test,
            // Realtime profile CRUD (PR-2a). New code uses these; the
            // legacy `update_realtime_config` above stays one release
            // for users still mid-migration.
            event_source_commands::list_realtime_profiles,
            event_source_commands::save_realtime_profile,
            event_source_commands::delete_realtime_profile,
            event_source_commands::activate_realtime_profile,
            // Supabase Realtime subscriber (Phase C).
            event_source_commands::start_realtime_event_stream,
            event_source_commands::stop_realtime_event_stream,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            // Window close (X / Cmd+W) hides to tray instead of exiting —
            // but only when the tray actually came up. Without a live tray
            // icon there's no way to bring the window back, so on platforms
            // where tray install failed we fall through and let Tauri exit
            // normally (which then routes through `ExitRequested` below for
            // the cooperative shutdown).
            tauri::RunEvent::WindowEvent {
                label,
                event: tauri::WindowEvent::CloseRequested { api, .. },
                ..
            } => {
                let state: tauri::State<'_, state::AppState> = app_handle.state();
                let has_tray = state
                    .tray_available
                    .load(std::sync::atomic::Ordering::SeqCst);
                if has_tray {
                    api.prevent_close();
                    if let Some(window) = app_handle.get_webview_window(&label) {
                        let _ = window.hide();
                    }
                }
            }
            // Dock icon clicked on macOS while every window was hidden —
            // re-show the main window so the app feels reachable.
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen {
                has_visible_windows: false,
                ..
            } => {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            // Real quit path (Cmd+Q, `app.exit()`, OS-driven shutdown):
            // run the cooperative cancellation sequence before exiting.
            //
            // `api.prevent_exit()` keeps Tauri from dropping the tokio
            // runtime out from under the shutdown task. We still
            // `std::process::exit(0)` at the end because the rayon-based
            // static scan can't be cleanly cancelled — same rationale as
            // the original hard-exit, but now with a 5s grace period
            // (see `shutdown::SHUTDOWN_DEADLINE`) for HTTP / DB to flush.
            tauri::RunEvent::ExitRequested { api, .. } => {
                api.prevent_exit();
                let app = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    shutdown::run(&app).await;
                    std::process::exit(0);
                });
            }
            _ => {}
        });
}
