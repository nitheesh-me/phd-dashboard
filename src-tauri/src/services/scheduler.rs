use sqlx::SqlitePool;
use tokio::time::{interval, Duration};
use tracing::{error, info};

pub fn spawn_background_jobs(pool: SqlitePool) {
    let git_pool = pool.clone();
    tauri::async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_secs(300));
        loop {
            ticker.tick().await;
            if let Err(error) = refresh_git_statuses(&git_pool).await {
                error!(?error, "git polling job failed");
            }
        }
    });

    tauri::async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_secs(60 * 60 * 24));
        loop {
            ticker.tick().await;
            if let Err(error) = refresh_citation_counts(&pool).await {
                error!(?error, "citation refresh job failed");
            }
        }
    });
}

async fn refresh_git_statuses(_pool: &SqlitePool) -> anyhow::Result<()> {
    info!("git polling tick executed");
    Ok(())
}

async fn refresh_citation_counts(_pool: &SqlitePool) -> anyhow::Result<()> {
    info!("citation refresh tick executed");
    Ok(())
}
