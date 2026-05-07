mod commands;
mod db;
mod docker;
mod events;
mod tray;
mod workflow;

use tauri::Manager;
use tracing::info;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(|app| {
            // Set up tray icon (best-effort; fails silently in headless test envs).
            if let Err(e) = tray::install(app.handle()) {
                tracing::warn!("tray install failed: {e}");
            }

            // Initialize SQLite app database.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = db::init(&handle).await {
                    tracing::error!("db init failed: {e:?}");
                }
                info!("drift-lab ready");
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_run,
            commands::cancel_run,
            commands::list_recent_runs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
