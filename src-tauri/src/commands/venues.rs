use tauri::State;
use uuid::Uuid;

use serde::Deserialize;

use crate::{
    db::repositories,
    domain::models::{Venue, VenueType},
    state::app_state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct CreateVenueInput {
    pub name: String,
    pub acronym: String,
    pub venue_type: VenueType,
    pub submission_deadline: Option<String>,
    pub abstract_deadline: Option<String>,
    pub url: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVenueInput {
    pub id: String,
    pub name: String,
    pub acronym: String,
    pub venue_type: VenueType,
    pub submission_deadline: Option<String>,
    pub abstract_deadline: Option<String>,
    pub url: Option<String>,
    pub version: Option<String>,
}

#[tauri::command]
pub async fn list_venues(state: State<'_, AppState>) -> Result<Vec<Venue>, String> {
    repositories::list_venues(&state.pool)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn create_venue(state: State<'_, AppState>, input: CreateVenueInput) -> Result<Venue, String> {
    repositories::create_venue(
        &state.pool,
        &Uuid::new_v4().to_string(),
        &input.name,
        &input.acronym,
        input.venue_type,
        input.submission_deadline.as_deref(),
        input.abstract_deadline.as_deref(),
        input.url.as_deref(),
        input.version.as_deref(),
    )
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn update_venue(state: State<'_, AppState>, input: UpdateVenueInput) -> Result<Venue, String> {
    repositories::update_venue(
        &state.pool,
        &input.id,
        &input.name,
        &input.acronym,
        input.venue_type,
        input.submission_deadline.as_deref(),
        input.abstract_deadline.as_deref(),
        input.url.as_deref(),
        input.version.as_deref(),
    )
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn delete_venue(state: State<'_, AppState>, id: String) -> Result<(), String> {
    repositories::delete_venue(&state.pool, &id)
        .await
        .map_err(|error| error.to_string())
}
