use crate::state::AppState;
use crate::terminal::{SharedTerminalState, ShellType};
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub async fn terminal_init(
    terminal_state: State<'_, SharedTerminalState>,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    let mut state = terminal_state.lock().map_err(|e| e.to_string())?;

    // Set working directory to current repo if available
    if let Some(path) = app_state.get_repo_path() {
        let path_str = path.to_string_lossy().to_string();
        state.set_working_dir(path);
        Ok(path_str)
    } else {
        // Use home directory as fallback
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        state.set_working_dir(home.clone());
        Ok(home.to_string_lossy().to_string())
    }
}

#[tauri::command]
pub async fn terminal_execute(
    command: String,
    terminal_state: State<'_, SharedTerminalState>,
) -> Result<String, String> {
    let state = terminal_state.lock().map_err(|e| e.to_string())?;
    state.execute_command(&command)
}

#[tauri::command]
pub async fn terminal_set_dir(
    path: String,
    terminal_state: State<'_, SharedTerminalState>,
) -> Result<(), String> {
    let mut state = terminal_state.lock().map_err(|e| e.to_string())?;
    let path_buf = PathBuf::from(&path);
    if path_buf.exists() && path_buf.is_dir() {
        state.set_working_dir(path_buf);
        Ok(())
    } else {
        Err(format!("Directory not found: {}", path))
    }
}

#[tauri::command]
pub async fn terminal_get_dir(
    terminal_state: State<'_, SharedTerminalState>,
) -> Result<String, String> {
    let state = terminal_state.lock().map_err(|e| e.to_string())?;
    Ok(state
        .get_working_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| ".".to_string()))
}

#[tauri::command]
pub async fn terminal_set_shell(
    shell_type: ShellType,
    terminal_state: State<'_, SharedTerminalState>,
) -> Result<(), String> {
    let mut state = terminal_state.lock().map_err(|e| e.to_string())?;
    state.set_shell_type(shell_type);
    Ok(())
}

#[tauri::command]
pub async fn terminal_get_shell(
    terminal_state: State<'_, SharedTerminalState>,
) -> Result<ShellType, String> {
    let state = terminal_state.lock().map_err(|e| e.to_string())?;
    Ok(state.get_shell_type().clone())
}
