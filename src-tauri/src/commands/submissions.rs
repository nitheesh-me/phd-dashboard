use tauri::State;
use uuid::Uuid;

use serde::Deserialize;

use crate::{
    db::repositories,
    domain::models::{CodeReleaseStatus, SubmissionStatus, SubmissionTracker},
    state::app_state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct CreateSubmissionTrackerInput {
    pub venue_id: String,
    pub paper_id: String,
    pub status: SubmissionStatus,
    pub openreview_link: Option<String>,
    pub code_release_status: CodeReleaseStatus,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSubmissionTrackerInput {
    pub id: String,
    pub venue_id: String,
    pub paper_id: String,
    pub status: SubmissionStatus,
    pub openreview_link: Option<String>,
    pub code_release_status: CodeReleaseStatus,
}

#[tauri::command]
pub async fn list_submission_trackers(state: State<'_, AppState>) -> Result<Vec<SubmissionTracker>, String> {
    repositories::list_submission_trackers(&state.pool)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn create_submission_tracker(
    state: State<'_, AppState>,
    input: CreateSubmissionTrackerInput,
) -> Result<SubmissionTracker, String> {
    repositories::create_submission_tracker(
        &state.pool,
        &Uuid::new_v4().to_string(),
        &input.venue_id,
        &input.paper_id,
        input.status,
        input.openreview_link.as_deref(),
        input.code_release_status,
    )
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn update_submission_tracker(
    state: State<'_, AppState>,
    input: UpdateSubmissionTrackerInput,
) -> Result<SubmissionTracker, String> {
    repositories::update_submission_tracker(
        &state.pool,
        &input.id,
        &input.venue_id,
        &input.paper_id,
        input.status,
        input.openreview_link.as_deref(),
        input.code_release_status,
    )
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn delete_submission_tracker(state: State<'_, AppState>, id: String) -> Result<(), String> {
    repositories::delete_submission_tracker(&state.pool, &id)
        .await
        .map_err(|error| error.to_string())
}
