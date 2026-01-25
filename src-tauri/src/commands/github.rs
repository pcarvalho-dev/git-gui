use crate::error::AppResult;
use crate::git;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn check_github_cli(state: State<'_, AppState>) -> AppResult<bool> {
    let repo_path = state.require_repo_path()?;
    git::check_gh_cli(&repo_path)
}

#[tauri::command]
pub async fn list_pull_requests(
    state: State<'_, AppState>,
    pr_state: Option<String>,
    limit: Option<u32>,
) -> AppResult<Vec<git::PullRequest>> {
    let repo_path = state.require_repo_path()?;
    git::list_pull_requests(&repo_path, pr_state.as_deref(), limit.unwrap_or(30))
}

#[tauri::command]
pub async fn get_pull_request(
    state: State<'_, AppState>,
    number: u64,
) -> AppResult<git::PullRequest> {
    let repo_path = state.require_repo_path()?;
    git::get_pull_request(&repo_path, number)
}

#[tauri::command]
pub async fn create_pull_request(
    state: State<'_, AppState>,
    title: String,
    body: Option<String>,
    base: String,
    head: Option<String>,
    draft: bool,
) -> AppResult<git::PullRequest> {
    let repo_path = state.require_repo_path()?;
    git::create_pull_request(
        &repo_path,
        &title,
        body.as_deref(),
        &base,
        head.as_deref(),
        draft,
    )
}

#[tauri::command]
pub async fn get_pull_request_reviews(
    state: State<'_, AppState>,
    number: u64,
) -> AppResult<Vec<git::PullRequestReview>> {
    let repo_path = state.require_repo_path()?;
    git::get_pull_request_reviews(&repo_path, number)
}

#[tauri::command]
pub async fn get_pull_request_comments(
    state: State<'_, AppState>,
    number: u64,
) -> AppResult<Vec<git::PullRequestComment>> {
    let repo_path = state.require_repo_path()?;
    git::get_pull_request_comments(&repo_path, number)
}

#[tauri::command]
pub async fn get_pull_request_files(
    state: State<'_, AppState>,
    number: u64,
) -> AppResult<Vec<git::PullRequestFile>> {
    let repo_path = state.require_repo_path()?;
    git::get_pull_request_files(&repo_path, number)
}

#[tauri::command]
pub async fn review_pull_request(
    state: State<'_, AppState>,
    number: u64,
    action: String,
    body: Option<String>,
) -> AppResult<()> {
    let repo_path = state.require_repo_path()?;
    git::review_pull_request(&repo_path, number, &action, body.as_deref())
}

#[tauri::command]
pub async fn comment_pull_request(
    state: State<'_, AppState>,
    number: u64,
    body: String,
) -> AppResult<()> {
    let repo_path = state.require_repo_path()?;
    git::comment_pull_request(&repo_path, number, &body)
}

#[tauri::command]
pub async fn merge_pull_request(
    state: State<'_, AppState>,
    number: u64,
    method: String,
    delete_branch: bool,
) -> AppResult<()> {
    let repo_path = state.require_repo_path()?;
    git::merge_pull_request(&repo_path, number, &method, delete_branch)
}

#[tauri::command]
pub async fn close_pull_request(state: State<'_, AppState>, number: u64) -> AppResult<()> {
    let repo_path = state.require_repo_path()?;
    git::close_pull_request(&repo_path, number)
}

#[tauri::command]
pub async fn reopen_pull_request(state: State<'_, AppState>, number: u64) -> AppResult<()> {
    let repo_path = state.require_repo_path()?;
    git::reopen_pull_request(&repo_path, number)
}

#[tauri::command]
pub async fn ready_pull_request(state: State<'_, AppState>, number: u64) -> AppResult<()> {
    let repo_path = state.require_repo_path()?;
    git::ready_pull_request(&repo_path, number)
}

#[tauri::command]
pub async fn get_pull_request_diff(
    state: State<'_, AppState>,
    number: u64,
) -> AppResult<String> {
    let repo_path = state.require_repo_path()?;
    git::get_pull_request_diff(&repo_path, number)
}

#[tauri::command]
pub async fn checkout_pull_request(state: State<'_, AppState>, number: u64) -> AppResult<()> {
    let repo_path = state.require_repo_path()?;
    git::checkout_pull_request(&repo_path, number)
}
