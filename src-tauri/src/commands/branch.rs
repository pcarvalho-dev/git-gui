use crate::error::AppResult;
use crate::git;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_branches(state: State<'_, AppState>) -> AppResult<Vec<git::BranchInfo>> {
    let repo = state.open_repo()?;
    git::list_branches(&repo)
}

#[tauri::command]
pub async fn get_current_branch(state: State<'_, AppState>) -> AppResult<String> {
    let repo = state.open_repo()?;
    git::get_current_branch(&repo)
}

#[tauri::command]
pub async fn create_branch(
    name: String,
    checkout: bool,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::create_branch(&repo, &name, checkout)
}

#[tauri::command]
pub async fn checkout_branch(name: String, state: State<'_, AppState>) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::checkout_branch(&repo, &name)
}

#[tauri::command]
pub async fn delete_branch(
    name: String,
    force: bool,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::delete_branch(&repo, &name, force)
}

#[tauri::command]
pub async fn rename_branch(
    old_name: String,
    new_name: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::rename_branch(&repo, &old_name, &new_name)
}

#[tauri::command]
pub async fn merge_branch(name: String, state: State<'_, AppState>) -> AppResult<String> {
    let repo = state.open_repo()?;
    git::merge_branch(&repo, &name)
}
