use crate::error::AppResult;
use crate::git;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn compare_refs(
    base_ref: String,
    head_ref: String,
    state: State<'_, AppState>,
) -> AppResult<git::CompareResult> {
    let repo = state.open_repo()?;
    git::compare_refs(&repo, &base_ref, &head_ref)
}
