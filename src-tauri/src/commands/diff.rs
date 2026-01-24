use crate::error::AppResult;
use crate::git;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_working_diff(state: State<'_, AppState>) -> AppResult<Vec<git::DiffInfo>> {
    let repo = state.open_repo()?;
    git::get_working_diff(&repo)
}

#[tauri::command]
pub async fn get_staged_diff(state: State<'_, AppState>) -> AppResult<Vec<git::DiffInfo>> {
    let repo = state.open_repo()?;
    git::get_staged_diff(&repo)
}

#[tauri::command]
pub async fn get_commit_diff(
    commit_hash: String,
    state: State<'_, AppState>,
) -> AppResult<Vec<git::DiffInfo>> {
    let repo = state.open_repo()?;
    git::get_commit_diff(&repo, &commit_hash)
}

#[tauri::command]
pub async fn get_file_diff(
    path: String,
    staged: bool,
    state: State<'_, AppState>,
) -> AppResult<git::DiffInfo> {
    let repo_path = state.require_repo_path()?;
    let repo = state.open_repo()?;
    git::get_file_diff(&repo, &path, staged, &repo_path)
}

#[tauri::command]
pub async fn get_file_blame(
    path: String,
    state: State<'_, AppState>,
) -> AppResult<Vec<git::BlameInfo>> {
    let repo = state.open_repo()?;
    git::get_file_blame(&repo, &path)
}
