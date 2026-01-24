use crate::error::AppResult;
use crate::git;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_commits(
    branch: Option<String>,
    limit: Option<usize>,
    skip: Option<usize>,
    state: State<'_, AppState>,
) -> AppResult<Vec<git::CommitInfo>> {
    let repo = state.open_repo()?;
    git::list_commits(
        &repo,
        branch.as_deref(),
        limit.unwrap_or(100),
        skip.unwrap_or(0),
    )
}

#[tauri::command]
pub async fn get_commit(
    hash: String,
    state: State<'_, AppState>,
) -> AppResult<git::CommitInfo> {
    let repo = state.open_repo()?;
    git::get_commit(&repo, &hash)
}

#[tauri::command]
pub async fn create_commit(
    message: String,
    amend: bool,
    state: State<'_, AppState>,
) -> AppResult<String> {
    let repo = state.open_repo()?;
    git::create_commit(&repo, &message, amend)
}

#[tauri::command]
pub async fn stage_files(
    files: Vec<String>,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let path = state.require_repo_path()?;
    let repo = state.open_repo()?;
    git::stage_files(&repo, &files, &path)
}

#[tauri::command]
pub async fn unstage_files(
    files: Vec<String>,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::unstage_files(&repo, &files)
}

#[tauri::command]
pub async fn stage_all(state: State<'_, AppState>) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::stage_all(&repo)
}

#[tauri::command]
pub async fn unstage_all(state: State<'_, AppState>) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::unstage_all(&repo)
}

#[tauri::command]
pub async fn discard_changes(
    files: Vec<String>,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::discard_changes(&repo, &files)
}

#[tauri::command]
pub async fn cherry_pick(
    commit_hash: String,
    state: State<'_, AppState>,
) -> AppResult<String> {
    let repo = state.open_repo()?;
    git::cherry_pick(&repo, &commit_hash)
}

#[tauri::command]
pub async fn revert_commit(
    commit_hash: String,
    state: State<'_, AppState>,
) -> AppResult<String> {
    let repo = state.open_repo()?;
    git::revert_commit(&repo, &commit_hash)
}

#[tauri::command]
pub async fn reset_to_commit(
    commit_hash: String,
    mode: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::reset_to_commit(&repo, &commit_hash, &mode)
}
