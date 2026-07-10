use tauri::State;
use uuid::Uuid;

use serde::Deserialize;

use crate::{
    db::repositories,
    domain::models::{EnvironmentType, GitStatus, Project},
    state::app_state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct CreateProjectInput {
    pub name: String,
    pub local_path: String,
    pub git_status: GitStatus,
    pub env_type: EnvironmentType,
    pub env_status: String,
    pub associated_paper_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectInput {
    pub id: String,
    pub name: String,
    pub local_path: String,
    pub git_status: GitStatus,
    pub env_type: EnvironmentType,
    pub env_status: String,
    pub associated_paper_id: Option<String>,
}

#[tauri::command]
pub async fn list_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    repositories::list_projects(&state.pool)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn create_project(
    state: State<'_, AppState>,
    input: CreateProjectInput,
) -> Result<Project, String> {
    repositories::create_project(
        &state.pool,
        &Uuid::new_v4().to_string(),
        &input.name,
        &input.local_path,
        input.git_status,
        input.env_type,
        &input.env_status,
        input.associated_paper_id.as_deref(),
    )
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn update_project(
    state: State<'_, AppState>,
    input: UpdateProjectInput,
) -> Result<Project, String> {
    repositories::update_project(
        &state.pool,
        &input.id,
        &input.name,
        &input.local_path,
        input.git_status,
        input.env_type,
        &input.env_status,
        input.associated_paper_id.as_deref(),
    )
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn delete_project(state: State<'_, AppState>, id: String) -> Result<(), String> {
    repositories::delete_project(&state.pool, &id)
        .await
        .map_err(|error| error.to_string())
}

/// Clone a git repo into `target_dir/repo_name` and return the cloned path.
/// Streams progress by running git clone; returns error string if it fails.
#[tauri::command]
pub async fn clone_git_repo(url: String, target_dir: String) -> Result<String, String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["clone", "--", &url, &target_dir])
        .output()
        .map_err(|e| format!("Failed to run git: {e}"))?;

    if output.status.success() {
        Ok(target_dir)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("git clone failed: {}", stderr.trim()))
    }
}

/// Check the git status of a local path.
/// Returns "Clean", "Dirty", "Unpushed", or "None" (not a git repo).
#[tauri::command]
pub async fn check_git_status(path: String) -> Result<String, String> {
    use std::process::Command;

    // Check if it is a git repo at all
    let is_repo = Command::new("git")
        .args(["-C", &path, "rev-parse", "--is-inside-work-tree"])
        .output()
        .map_err(|e| format!("Failed to run git: {e}"))?;

    if !is_repo.status.success() {
        return Ok("None".to_string());
    }

    // Check for uncommitted changes
    let status = Command::new("git")
        .args(["-C", &path, "status", "--porcelain"])
        .output()
        .map_err(|e| format!("Failed to run git status: {e}"))?;

    let dirty = !String::from_utf8_lossy(&status.stdout).trim().is_empty();
    if dirty {
        return Ok("Dirty".to_string());
    }

    // Check for unpushed commits
    let unpushed = Command::new("git")
        .args(["-C", &path, "log", "--oneline", "@{u}..HEAD"])
        .output();

    if let Ok(out) = unpushed {
        if out.status.success() && !String::from_utf8_lossy(&out.stdout).trim().is_empty() {
            return Ok("Unpushed".to_string());
        }
    }

    Ok("Clean".to_string())
}
