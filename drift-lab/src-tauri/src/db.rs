//! App-local SQLite store: run history, settings, cached image metadata.

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
        .context("failed to resolve app data dir")?;
    std::fs::create_dir_all(&dir).context("create app data dir")?;
    Ok(dir.join("drift-lab.sqlite"))
}

pub async fn init<R: Runtime>(app: &AppHandle<R>) -> Result<()> {
    let path = db_path(app)?;
    let opts = SqliteConnectOptions::new()
        .filename(&path)
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new().max_connections(5).connect_with(opts).await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS runs (
            run_id TEXT PRIMARY KEY,
            project_path TEXT NOT NULL,
            created_at TEXT NOT NULL,
            finished_at TEXT,
            issues_found INTEGER,
            critical_count INTEGER,
            error TEXT
        );
        "#,
    )
    .execute(&pool)
    .await?;

    POOL.set(pool).ok();
    Ok(())
}

#[allow(dead_code)]
pub fn pool() -> Option<&'static SqlitePool> {
    POOL.get()
}
