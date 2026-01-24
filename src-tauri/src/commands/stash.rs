use crate::error::AppResult;
use crate::git;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_stash_list(state: State<'_, AppState>) -> AppResult<Vec<git::StashInfo>> {
    let mut repo = state.open_repo()?;
    git::list_stashes(&mut repo)
}

#[tauri::command]
pub async fn create_stash(
    message: Option<String>,
    include_untracked: bool,
    keep_index: bool,
    state: State<'_, AppState>,
) -> AppResult<String> {
    let mut repo = state.open_repo()?;
    git::create_stash(&mut repo, message.as_deref(), include_untracked, keep_index)
}

#[tauri::command]
pub async fn apply_stash(
    index: usize,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let mut repo = state.open_repo()?;
    git::apply_stash(&mut repo, index, false)
}

#[tauri::command]
pub async fn pop_stash(
    index: usize,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let mut repo = state.open_repo()?;
    git::apply_stash(&mut repo, index, true)
}

#[tauri::command]
pub async fn drop_stash(
    index: usize,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let mut repo = state.open_repo()?;
    git::drop_stash(&mut repo, index)
}

#[tauri::command]
pub async fn clear_stashes(state: State<'_, AppState>) -> AppResult<()> {
    let mut repo = state.open_repo()?;
    git::clear_stashes(&mut repo)
}
