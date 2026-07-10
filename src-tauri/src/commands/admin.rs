use tauri::State;
use serde::{Deserialize, Serialize};

use crate::{db::repositories, state::app_state::AppState};

#[tauri::command]
pub async fn clear_all_data(state: State<'_, AppState>) -> Result<(), String> {
    repositories::clear_all_data(&state.pool)
        .await
        .map_err(|error| error.to_string())
}

// ── Export / Import ───────────────────────────────────────────────

#[derive(Serialize)]
pub struct ExportBundle {
    pub version: u32,
    pub exported_at: String,
    pub projects: Vec<crate::domain::models::Project>,
    pub references: Vec<crate::domain::models::Reference>,
    pub venues: Vec<crate::domain::models::Venue>,
    pub submissions: Vec<crate::domain::models::SubmissionTracker>,
    pub people: Vec<crate::domain::models::Person>,
}

#[tauri::command]
pub async fn export_all_data(state: State<'_, AppState>) -> Result<String, String> {
    let pool = &state.pool;
    let projects = repositories::list_projects(pool).await.map_err(|e| e.to_string())?;
    let references = repositories::list_references(pool).await.map_err(|e| e.to_string())?;
    let venues = repositories::list_venues(pool).await.map_err(|e| e.to_string())?;
    let submissions = repositories::list_submission_trackers(pool).await.map_err(|e| e.to_string())?;
    let people = repositories::list_people(pool).await.map_err(|e| e.to_string())?;

    let bundle = ExportBundle {
        version: 1,
        exported_at: chrono::Utc::now().to_rfc3339(),
        projects,
        references,
        venues,
        submissions,
        people,
    };

    serde_json::to_string_pretty(&bundle).map_err(|e| e.to_string())
}

#[allow(dead_code)]
#[derive(Deserialize)]
pub struct ImportBundle {
    pub version: Option<u32>,
    pub projects: Option<Vec<crate::domain::models::Project>>,
    pub references: Option<Vec<crate::domain::models::Reference>>,
    pub venues: Option<Vec<crate::domain::models::Venue>>,
    pub submissions: Option<Vec<crate::domain::models::SubmissionTracker>>,
    pub people: Option<Vec<crate::domain::models::Person>>,
}

/// mode: "append" inserts new records (skips conflicts), "override" wipes first.
#[tauri::command]
pub async fn import_data(state: State<'_, AppState>, json: String, mode: String) -> Result<(), String> {
    let bundle: ImportBundle = serde_json::from_str(&json).map_err(|e| format!("invalid import file: {e}"))?;
    let pool = &state.pool;

    if mode == "override" {
        repositories::clear_all_data(pool).await.map_err(|e| e.to_string())?;
    }

    repositories::import_bundle(
        pool,
        bundle.projects.unwrap_or_default(),
        bundle.references.unwrap_or_default(),
        bundle.venues.unwrap_or_default(),
        bundle.submissions.unwrap_or_default(),
        bundle.people.unwrap_or_default(),
    )
    .await
    .map_err(|e| e.to_string())
}
// ── Deep work logging ────────────────────────────────────────────

#[tauri::command]
pub async fn log_deep_work(
  state: State<'_, AppState>,
  title: String,
  duration_minutes: i32,
  work_type: String,
  project_id: Option<String>,
) -> Result<(), String> {
  repositories::create_pomodoro_task(
    &state.pool,
    &uuid::Uuid::new_v4().to_string(),
    &title,
    duration_minutes,
    &work_type,
    project_id.as_deref(),
  )
  .await
  .map_err(|e| e.to_string())
}