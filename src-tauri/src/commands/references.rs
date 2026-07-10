use tauri::State;
use uuid::Uuid;

use serde::Deserialize;

use crate::{
    db::repositories,
    domain::models::{ReadStatus, Reference},
    state::app_state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct CreateReferenceInput {
    pub title: String,
    pub authors: Vec<String>,
    pub abstract_text: Option<String>,
    pub doi: Option<String>,
    pub arxiv_id: Option<String>,
    pub tags: Vec<String>,
    pub read_status: ReadStatus,
}

#[derive(Debug, Deserialize)]
pub struct UpdateReferenceInput {
    pub id: String,
    pub title: String,
    pub authors: Vec<String>,
    pub abstract_text: Option<String>,
    pub doi: Option<String>,
    pub arxiv_id: Option<String>,
    pub tags: Vec<String>,
    pub read_status: ReadStatus,
    pub rating: Option<i32>,
}

#[tauri::command]
pub async fn list_references(state: State<'_, AppState>) -> Result<Vec<Reference>, String> {
    repositories::list_references(&state.pool)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn create_reference(
    state: State<'_, AppState>,
    input: CreateReferenceInput,
) -> Result<Reference, String> {
    repositories::create_reference(
        &state.pool,
        &Uuid::new_v4().to_string(),
        &input.title,
        &input.authors,
        input.abstract_text.as_deref(),
        input.doi.as_deref(),
        input.arxiv_id.as_deref(),
        &input.tags,
        input.read_status,
    )
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn update_reference(
    state: State<'_, AppState>,
    input: UpdateReferenceInput,
) -> Result<Reference, String> {
    repositories::update_reference(
        &state.pool,
        &input.id,
        &input.title,
        &input.authors,
        input.abstract_text.as_deref(),
        input.doi.as_deref(),
        input.arxiv_id.as_deref(),
        &input.tags,
        input.read_status,
        input.rating,
    )
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn delete_reference(state: State<'_, AppState>, id: String) -> Result<(), String> {
    repositories::delete_reference(&state.pool, &id)
        .await
        .map_err(|error| error.to_string())
}
