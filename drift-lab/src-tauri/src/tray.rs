//! System-tray icon + menu. Keeps the app resident after the user closes
//! the main window so a background scan / running agent doesn't get
//! killed by a stray Cmd+W. Standard tray-app UX (Slack, Discord,
//! 1Password, Ollama): closing the window hides it; only "Quit" from the
//! tray actually exits.
//!
//! ## Click behavior
//!
//! A **single primary click** on the tray icon opens the menu — the
//! native macOS pattern every menu-bar app the user is familiar with
//! follows (Ollama, 1Password, Bartender, …). We previously bound
//! left-click to "show the main window" directly via
//! `show_menu_on_left_click(false)` + an `on_tray_icon_event` handler,
//! but that broke discoverability: there was no way to reach Settings /
//! Quit / Viewer / Docs without two-finger right-clicking the icon, which
//! most macOS users never try on the menu bar. The first menu item
//! ("Open Drift Lab") preserves the one-extra-click path to the window.
//!
//! Menu layout (top → bottom):
//!   - **Open Drift Lab** — show + focus the main window. First so it's
//!     a one-click affordance even though the menu is the entry point.
//!   - **Settings…** — show the window and deep-link to `/settings` by
//!     emitting `tray://open-settings`. The React app listens for the
//!     event and navigates without disturbing the URL bar otherwise.
//!   - separator
//!   - **Open Viewer (browser)** — opens the bundled HTTP server at `/`
//!     (the static-profiler React SPA) in the system browser via
//!     `tauri_plugin_opener`. Mirrors the in-app `LocalServerLinks`
//!     button so the action is reachable even when the main window is
//!     hidden.
//!   - **API Docs (Swagger)** — opens `/docs`. Same rationale.
//!   - separator
//!   - **Quit Drift Lab** — fires the cooperative shutdown sequence in
//!     [`crate::shutdown`] before exiting the process. Placed last and
//!     separated from the non-destructive items so it isn't mis-clicked.

use anyhow::{Context, Result};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, Runtime,
};
use tauri_plugin_opener::OpenerExt;

/// Event the tray emits to navigate the UI to `/settings`. The React app
/// listens for this via `listen()` in `App.tsx` and calls
/// `navigate('/settings')`. Kept as a string constant so the wire name
/// can't drift between Rust and TS.
pub const EVENT_OPEN_SETTINGS: &str = "tray://open-settings";

pub fn install<R: Runtime>(app: &AppHandle<R>) -> Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Drift Lab", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let viewer = MenuItem::with_id(
        app,
        "open_viewer",
        "Open Viewer (browser)",
        true,
        None::<&str>,
    )?;
    let docs = MenuItem::with_id(app, "open_docs", "API Docs (Swagger)", true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Drift Lab", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&open, &settings, &sep1, &viewer, &docs, &sep2, &quit],
    )?;

    // Reuse the bundle icon from `tauri.conf.json` so we don't have to ship
    // a second asset. Without an explicit `.icon(...)` call the tray
    // builder succeeds but macOS has nothing to draw in the menu bar —
    // the icon silently never appears.
    //
    // The icon is full-color RGBA. We deliberately do NOT call
    // `.icon_as_template(true)` because that would force macOS to render
    // it as a monochrome silhouette, which collapses the multi-color logo
    // to a solid blob. If we ever ship a dedicated monochrome
    // `tray-icon.png`, swap to template mode at the same time.
    let icon = app
        .default_window_icon()
        .cloned()
        .context("no default window icon configured in tauri.conf.json bundle.icon")?;

    TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        // `show_menu_on_left_click` defaults to `true` on macOS — meaning
        // a single click on the menu-bar icon pops the menu (Ollama,
        // 1Password, Bartender, …). We deliberately do NOT override it
        // here. An earlier revision bound left-click to "show the main
        // window" via `.show_menu_on_left_click(false)` + an
        // `on_tray_icon_event` handler, but that left users with no
        // discoverable way to reach Settings / Quit / Viewer / Docs
        // because macOS doesn't naturally expose right-click on the
        // menu bar. The "Open Drift Lab" item below restores the
        // one-extra-click path to the window.
        .tooltip("Drift Lab — click for menu")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "settings" => {
                show_main_window(app);
                // Fire AFTER the show so the listener (mounted on the
                // window's webview) is alive when the event reaches it.
                let _ = app.emit(EVENT_OPEN_SETTINGS, ());
            }
            "open_viewer" => open_http_path(app, "/"),
            "open_docs" => open_http_path(app, "/docs"),
            "quit" => spawn_quit(app),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

/// Show + focus the `main` window. On macOS a hidden window also needs
/// `unminimize` because `app.hide()` may have parked it; `set_focus`
/// alone won't bring it forward in that case.
fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

/// Run the cooperative shutdown sequence, then exit. Spawned onto the
/// async runtime because the tray's `on_menu_event` callback is
/// synchronous and we need `.await` for the HTTP server / DB drain.
fn spawn_quit<R: Runtime>(app: &AppHandle<R>) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        crate::shutdown::run(&app).await;
        // Same rationale as the `ExitRequested` branch in `lib.rs`: the
        // rayon-based static scan can't be cleanly cancelled, so after
        // the deadline we exit hard instead of waiting on a
        // potentially-multi-minute analysis to finish. `shutdown::run`
        // also arms a doomsday timer so this `exit(0)` is just the
        // fast-path — if anything wedges, the timer fires `exit(137)`
        // independently within the hard deadline.
        std::process::exit(0);
    });
}

/// Open `path` (rooted at the bundled HTTP server URL) in the system
/// browser. No-op + warn when the HTTP server hasn't bound yet (rare —
/// the server starts in a setup-time task and is normally up well before
/// the user can interact with the tray, but a click during the bind race
/// shouldn't crash the app).
fn open_http_path<R: Runtime>(app: &AppHandle<R>, path: &str) {
    let Some(base) = crate::http_server::server_url() else {
        tracing::warn!("tray: HTTP server not yet bound — ignoring open request for {path}");
        return;
    };
    let url = format!("{base}{path}");
    if let Err(e) = app.opener().open_url(&url, None::<&str>) {
        tracing::warn!("tray: failed to open {url}: {e}");
    }
}
