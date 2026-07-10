use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, FilePath};
use tauri_plugin_opener::OpenerExt;

/// Show a native "Save As" dialog and write content to the chosen path.
/// Returns the saved path string, or an empty string if the user cancelled.
#[tauri::command]
pub async fn save_text_file(
    app: tauri::AppHandle,
    filename: String,
    content: String,
) -> Result<String, String> {
    let default_dir = downloads_dir(&app);

    let path: Option<FilePath> = app
        .dialog()
        .file()
        .set_file_name(&filename)
        .set_directory(&default_dir)
        .blocking_save_file();

    let file_path = match path {
        Some(fp) => fp,
        None => return Ok(String::new()), // user cancelled
    };

    let path_buf: PathBuf = match file_path {
        FilePath::Path(p) => p,
        FilePath::Url(u) => PathBuf::from(u.path()),
    };

    tokio::fs::write(&path_buf, content)
        .await
        .map_err(|e| e.to_string())?;

    Ok(path_buf.to_string_lossy().to_string())
}

/// Write HTML to a temp file and open it in the system browser for printing.
#[tauri::command]
pub async fn open_html_for_print(
    app: tauri::AppHandle,
    html: String,
) -> Result<(), String> {
    let tmp_dir = std::env::temp_dir();
    let file_name = format!("scholaros_report_{}.html", uuid_fragment());
    let path = tmp_dir.join(&file_name);

    tokio::fs::write(&path, html)
        .await
        .map_err(|e| e.to_string())?;

    app.opener()
        .open_path(path.to_string_lossy().as_ref(), None::<&str>)
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn uuid_fragment() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn downloads_dir(app: &tauri::AppHandle) -> PathBuf {
    if let Ok(xdg) = std::env::var("XDG_DOWNLOAD_DIR") {
        let p = PathBuf::from(xdg);
        if p.is_dir() { return p; }
    }
    if let Some(home) = std::env::var_os("HOME") {
        let p = PathBuf::from(home).join("Downloads");
        if p.is_dir() { return p; }
        if std::fs::create_dir_all(&p).is_ok() { return p; }
    }
    app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."))
}
