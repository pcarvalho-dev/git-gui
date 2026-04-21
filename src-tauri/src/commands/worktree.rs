use crate::error::AppResult;
use crate::git;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn list_worktrees(state: State<'_, AppState>) -> AppResult<Vec<git::WorktreeInfo>> {
    let path = state.require_repo_path()?;
    git::list_worktrees(&path)
}

#[tauri::command]
pub async fn add_worktree(
    path: String,
    branch: String,
    create_branch: bool,
    state: State<'_, AppState>,
) -> AppResult<git::WorktreeInfo> {
    let repo_path = state.require_repo_path()?;
    git::add_worktree(&repo_path, &path, &branch, create_branch)
}

#[tauri::command]
pub async fn remove_worktree(
    path: String,
    force: bool,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let repo_path = state.require_repo_path()?;
    git::remove_worktree(&repo_path, &path, force)
}

#[tauri::command]
pub async fn lock_worktree(
    path: String,
    reason: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let repo_path = state.require_repo_path()?;
    git::lock_worktree(&repo_path, &path, reason.as_deref())
}

#[tauri::command]
pub async fn unlock_worktree(
    path: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let repo_path = state.require_repo_path()?;
    git::unlock_worktree(&repo_path, &path)
}
