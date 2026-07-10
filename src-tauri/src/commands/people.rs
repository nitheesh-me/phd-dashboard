use tauri::State;
use uuid::Uuid;
use serde::Deserialize;

use crate::{
    db::repositories,
    domain::models::Person,
    state::app_state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct CreatePersonInput {
    pub name: String,
    pub email: Option<String>,
    pub institution: Option<String>,
    pub relationship: String,
    pub notes: Option<String>,
    pub last_contacted: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePersonInput {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub institution: Option<String>,
    pub relationship: String,
    pub notes: Option<String>,
    pub last_contacted: Option<String>,
}

#[tauri::command]
pub async fn list_people(state: State<'_, AppState>) -> Result<Vec<Person>, String> {
    repositories::list_people(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_person(state: State<'_, AppState>, input: CreatePersonInput) -> Result<Person, String> {
    repositories::create_person(
        &state.pool,
        &Uuid::new_v4().to_string(),
        &input.name,
        input.email.as_deref(),
        input.institution.as_deref(),
        &input.relationship,
        input.notes.as_deref(),
        input.last_contacted.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_person(state: State<'_, AppState>, input: UpdatePersonInput) -> Result<Person, String> {
    repositories::update_person(
        &state.pool,
        &input.id,
        &input.name,
        input.email.as_deref(),
        input.institution.as_deref(),
        &input.relationship,
        input.notes.as_deref(),
        input.last_contacted.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_person(state: State<'_, AppState>, id: String) -> Result<(), String> {
    repositories::delete_person(&state.pool, &id)
        .await
        .map_err(|e| e.to_string())
}
