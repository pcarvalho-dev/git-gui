use crate::config::{AppConfig, RecentRepo};
use crate::error::AppResult;
use crate::git;
use crate::state::AppState;
use std::path::PathBuf;
use tauri::State;

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
