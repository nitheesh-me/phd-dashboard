mod commands;
mod db;
mod domain;
mod services;
mod state;

use tauri::Manager;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::state::app_state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new("scholaros=info"))
        .with(tracing_subscriber::fmt::layer())
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let pool = match tauri::async_runtime::block_on(db::initialize_database(&app_handle)) {
                Ok(pool) => pool,
                Err(error) => {
                    eprintln!("database initialization failed:\n{error:#}");
                    return Err(error.into());
                }
            };
            services::scheduler::spawn_background_jobs(pool.clone());
            app.manage(AppState { pool });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::admin::clear_all_data,
            commands::admin::export_all_data,
            commands::admin::import_data,
            commands::admin::log_deep_work,
            commands::dashboard::get_dashboard_snapshot,
            commands::people::list_people,
            commands::people::create_person,
            commands::people::update_person,
            commands::people::delete_person,
            commands::projects::list_projects,
            commands::projects::create_project,
            commands::projects::update_project,
            commands::projects::delete_project,
            commands::projects::clone_git_repo,
            commands::projects::check_git_status,
            commands::references::list_references,
            commands::references::create_reference,
            commands::references::update_reference,
            commands::references::delete_reference,
            commands::submissions::list_submission_trackers,
            commands::submissions::create_submission_tracker,
            commands::submissions::update_submission_tracker,
            commands::submissions::delete_submission_tracker,
            commands::venues::list_venues,
            commands::venues::create_venue,
            commands::venues::update_venue,
            commands::venues::delete_venue,
            commands::files::save_text_file,
            commands::files::open_html_for_print,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ScholarOS application");
}
