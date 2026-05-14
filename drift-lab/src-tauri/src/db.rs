//! SQLite app-store. Single file at `<app_data_dir>/drift-lab.sqlite`.
//!
//! Currently holds the local-runtime discovery cache (`runtime_cache`) so
//! the UI can render last-known runtimes instantly while a fresh probe
//! runs in the background. Add more tables here as new persistence needs
//! land — the pool is a process-wide `OnceCell`, so any module can call
//! [`pool()`] after [`init`] runs.

use std::path::PathBuf;

use anyhow::{Context, Result};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager, Runtime};
use tokio::sync::OnceCell;

static POOL: OnceCell<SqlitePool> = OnceCell::const_new();

fn db_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .context("resolving app data dir")?;
    std::fs::create_dir_all(&dir).context("creating app data dir")?;
    Ok(dir.join("drift-lab.sqlite"))
}

/// Open the SQLite file (creating it if missing), apply migrations, and
/// stash the pool in the process-wide `OnceCell`. Safe to call multiple
/// times — only the first call does work.
pub async fn init<R: Runtime>(app: &AppHandle<R>) -> Result<()> {
    if POOL.get().is_some() {
        return Ok(());
    }
    let path = db_path(app)?;
    tracing::info!(path = %path.display(), "opening sqlite store");
    let opts = SqliteConnectOptions::new()
        .filename(&path)
        .create_if_missing(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(opts)
        .await
        .context("connecting sqlite pool")?;
    migrate(&pool).await?;
    let _ = POOL.set(pool);
    Ok(())
}

/// Apply the schema. Each statement is idempotent (`CREATE TABLE IF NOT
/// EXISTS`) so calling this on an already-initialized DB is a no-op.
async fn migrate(pool: &SqlitePool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS runtime_cache (
            preset_id    TEXT PRIMARY KEY,
            name         TEXT NOT NULL,
            base_url     TEXT NOT NULL,
            models_json  TEXT NOT NULL,
            note         TEXT,
            last_seen_at INTEGER NOT NULL
        );
        "#,
    )
    .execute(pool)
    .await
    .context("creating runtime_cache table")?;
    Ok(())
}

/// Returns the process-wide pool, or `None` if [`init`] hasn't run yet.
/// All callers should treat `None` as "fall back to a fresh probe" — it
/// shouldn't happen in production but is the right contract in tests.
pub fn pool() -> Option<&'static SqlitePool> {
    POOL.get()
}

/// Close the pool gracefully (flush in-flight statements + drop
/// connections). Called by the app's shutdown path so SQLite isn't left
/// with a half-written WAL when the process exits.
pub async fn close() {
    if let Some(pool) = POOL.get() {
        pool.close().await;
    }
}
