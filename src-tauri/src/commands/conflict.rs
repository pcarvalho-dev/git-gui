use crate::error::AppResult;
use crate::git;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_conflict_info(
    state: State<'_, AppState>,
    path: String,
) -> AppResult<git::ConflictInfo> {
    let repo = state.open_repo()?;
    git::get_conflict_info(&repo, &path)
}

#[tauri::command]
pub async fn get_conflicted_file(
    state: State<'_, AppState>,
    path: String,
) -> AppResult<String> {
    let repo = state.open_repo()?;
    git::get_conflicted_file_content(&repo, &path)
}

#[tauri::command]
pub async fn resolve_conflict(
    state: State<'_, AppState>,
    path: String,
    content: String,
    mark_resolved: bool,
) -> AppResult<()> {
    let repo = state.open_repo()?;

    // Save the resolved content
    git::save_resolved_file(&repo, &path, &content)?;

    // Optionally mark as resolved (stage the file)
    if mark_resolved {
        git::mark_resolved(&repo, &path)?;
    }

    Ok(())
}

#[tauri::command]
pub async fn abort_merge(state: State<'_, AppState>) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::abort_merge(&repo)
}
