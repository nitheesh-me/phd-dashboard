use tauri::State;

use crate::{db::repositories, state::app_state::AppState};

#[tauri::command]
pub async fn get_dashboard_snapshot(
    state: State<'_, AppState>,
) -> Result<repositories::DashboardSnapshot, String> {
    repositories::load_dashboard_snapshot(&state.pool)
        .await
        .map_err(|error| error.to_string())
}
