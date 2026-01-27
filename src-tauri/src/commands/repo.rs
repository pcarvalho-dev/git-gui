use crate::config::{AppConfig, RecentRepo};
use crate::error::AppResult;
use crate::git;
use crate::state::AppState;
use std::path::PathBuf;
use tauri::State;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
pub async fn open_repo(
    path: String,
    state: State<'_, AppState>,
) -> AppResult<git::RepoInfo> {
    let repo_path = PathBuf::from(&path);
    let info = git::get_repo_info(&repo_path)?;

    if info.is_repo {
        state.set_repo_path(repo_path);

        // Add to recent repos
        let mut config = AppConfig::load();
        config.add_recent_repo(&path);
    }

    Ok(info)
}

#[tauri::command]
pub async fn close_repo(state: State<'_, AppState>) -> AppResult<()> {
    state.clear_repo();
    Ok(())
}

#[tauri::command]
pub async fn close_repo_by_id(id: String, state: State<'_, AppState>) -> AppResult<()> {
    state.close_repo_by_id(&id);
    Ok(())
}

#[tauri::command]
pub async fn get_open_repos(state: State<'_, AppState>) -> AppResult<Vec<OpenRepoInfo>> {
    let repos = state.get_open_repos();
    let active_id = state.get_active_repo_id();

    let mut result = Vec::new();
    for (id, path) in repos {
        let info = git::get_repo_info(&path)?;
        result.push(OpenRepoInfo {
            id: id.clone(),
            path: path.to_string_lossy().to_string(),
            name: info.name,
            is_active: active_id.as_ref() == Some(&id),
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn set_active_repo(id: String, state: State<'_, AppState>) -> AppResult<bool> {
    Ok(state.set_active_repo(&id))
}

#[derive(serde::Serialize)]
pub struct OpenRepoInfo {
    pub id: String,
    pub path: String,
    pub name: String,
    pub is_active: bool,
}

#[tauri::command]
pub async fn get_repo_info(state: State<'_, AppState>) -> AppResult<git::RepoInfo> {
    let path = state.require_repo_path()?;
    git::get_repo_info(&path)
}

#[tauri::command]
pub async fn get_repo_status(state: State<'_, AppState>) -> AppResult<git::RepoStatus> {
    let repo = state.open_repo()?;
    git::get_status(&repo)
}

#[tauri::command]
pub async fn init_repo(path: String, bare: bool) -> AppResult<git::RepoInfo> {
    let repo_path = PathBuf::from(&path);
    git::init_repository(&repo_path, bare)?;
    git::get_repo_info(&repo_path)
}

#[tauri::command]
pub async fn clone_repo(
    url: String,
    path: String,
    state: State<'_, AppState>,
) -> AppResult<git::RepoInfo> {
    let repo_path = PathBuf::from(&path);
    git::clone_repository(&url, &repo_path)?;

    let info = git::get_repo_info(&repo_path)?;

    if info.is_repo {
        state.set_repo_path(repo_path);

        let mut config = AppConfig::load();
        config.add_recent_repo(&path);
    }

    Ok(info)
}

#[tauri::command]
pub async fn get_recent_repos() -> AppResult<Vec<RecentRepo>> {
    let config = AppConfig::load();
    Ok(config.get_recent_repos())
}

#[tauri::command]
pub async fn remove_recent_repo(path: String) -> AppResult<()> {
    let mut config = AppConfig::load();
    config.remove_recent_repo(&path);
    Ok(())
}

#[tauri::command]
pub async fn clear_recent_repos() -> AppResult<()> {
    let mut config = AppConfig::load();
    config.recent_repos.clear();
    config.save()?;
    Ok(())
}

#[tauri::command]
pub async fn get_git_config_value(
    key: String,
    state: State<'_, AppState>,
) -> AppResult<Option<String>> {
    let repo = state.open_repo()?;
    Ok(git::get_git_config(&repo, &key))
}

#[tauri::command]
pub async fn set_git_config_value(
    key: String,
    value: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::set_git_config(&repo, &key, &value)
}

#[tauri::command]
pub async fn read_file(state: State<'_, AppState>, path: String) -> AppResult<String> {
    let repo_path = state.require_repo_path()?;
    let full_path = repo_path.join(&path);

    std::fs::read_to_string(&full_path).map_err(|e| {
        crate::error::AppError::with_details("READ_ERROR", "Erro ao ler arquivo", &e.to_string())
    })
}

#[tauri::command]
pub async fn write_file(state: State<'_, AppState>, path: String, content: String) -> AppResult<()> {
    let repo_path = state.require_repo_path()?;
    let full_path = repo_path.join(&path);

    std::fs::write(&full_path, content).map_err(|e| {
        crate::error::AppError::with_details("WRITE_ERROR", "Erro ao salvar arquivo", &e.to_string())
    })
}

#[tauri::command]
pub async fn open_in_vscode(state: State<'_, AppState>) -> AppResult<()> {
    let path = state.require_repo_path()?;
    let path_str = path.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", "code", &path_str]);
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.spawn()
            .map_err(|e| crate::error::AppError::with_details("VSCODE_ERROR", "Falha ao abrir VS Code", &e.to_string()))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-a", "Visual Studio Code", &path_str])
            .spawn()
            .map_err(|e| crate::error::AppError::with_details("VSCODE_ERROR", "Falha ao abrir VS Code", &e.to_string()))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("code")
            .arg(&path_str)
            .spawn()
            .map_err(|e| crate::error::AppError::with_details("VSCODE_ERROR", "Falha ao abrir VS Code", &e.to_string()))?;
    }

    Ok(())
}
