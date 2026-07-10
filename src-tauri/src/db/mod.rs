pub mod repositories;

use std::path::PathBuf;
use std::str::FromStr;

use anyhow::Context;
use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};
use tauri::{AppHandle, Manager};

static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

pub async fn initialize_database(app: &AppHandle) -> anyhow::Result<SqlitePool> {
    let app_dir = resolve_app_dir(app)?;
    tokio::fs::create_dir_all(&app_dir).await.with_context(|| {
        format!(
            "failed to create app data directory at {}",
            app_dir.display()
        )
    })?;

    let db_path = app_dir.join("scholaros.db");
    let database_url = format!("sqlite://{}", db_path.display());

    let connect_options = SqliteConnectOptions::from_str(&database_url)
        .with_context(|| format!("invalid sqlite url {}", database_url))?
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(8)
        .connect_with(connect_options)
        .await
        .with_context(|| {
            format!(
                "failed to connect to sqlite database at {}",
                db_path.display()
            )
        })?;

    sqlx::query("PRAGMA foreign_keys = ON;")
        .execute(&pool)
        .await
        .context("failed to enable sqlite foreign keys")?;

    MIGRATOR
        .run(&pool)
        .await
        .context("failed to apply initial schema")?;

    Ok(pool)
}

fn resolve_app_dir(app: &AppHandle) -> anyhow::Result<PathBuf> {
    app.path()
        .app_data_dir()
        .context("failed to resolve app data directory")
}

