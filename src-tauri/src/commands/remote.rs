use crate::error::AppResult;
use crate::git;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_remotes(state: State<'_, AppState>) -> AppResult<Vec<git::RemoteInfo>> {
    let repo = state.open_repo()?;
    git::list_remotes(&repo)
}

#[tauri::command]
pub async fn add_remote(
    name: String,
    url: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::add_remote(&repo, &name, &url)
}

#[tauri::command]
pub async fn remove_remote(
    name: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::remove_remote(&repo, &name)
}

#[tauri::command]
pub async fn rename_remote(
    old_name: String,
    new_name: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::rename_remote(&repo, &old_name, &new_name)
}

#[tauri::command]
pub async fn fetch_remote(
    remote: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::fetch(&repo, remote.as_deref())
}

#[tauri::command]
pub async fn pull_remote(
    remote: String,
    branch: String,
    state: State<'_, AppState>,
) -> AppResult<String> {
    let repo = state.open_repo()?;
    git::pull(&repo, &remote, &branch)
}

#[tauri::command]
pub async fn push_remote(
    remote: String,
    branch: String,
    force: bool,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::push(&repo, &remote, &branch, force)
}

#[tauri::command]
pub async fn set_upstream(
    branch: String,
    remote: String,
    remote_branch: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::set_upstream(&repo, &branch, &remote, &remote_branch)
}
