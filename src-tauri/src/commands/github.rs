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

// ─── Issues ───────────────────────────────

#[tauri::command]
pub async fn list_issues(
    state: State<'_, AppState>,
    issue_state: Option<String>,
    limit: Option<u32>,
    label: Option<String>,
    assignee: Option<String>,
    milestone: Option<String>,
) -> AppResult<Vec<git::Issue>> {
    let repo_path = state.require_repo_path()?;
    git::list_issues(
        &repo_path,
        issue_state.as_deref(),
        limit.unwrap_or(50),
        label.as_deref(),
        assignee.as_deref(),
        milestone.as_deref(),
    )
}

#[tauri::command]
pub async fn get_issue(state: State<'_, AppState>, number: u64) -> AppResult<git::Issue> {
    let repo_path = state.require_repo_path()?;
    git::get_issue(&repo_path, number)
}

#[tauri::command]
pub async fn create_issue(
    state: State<'_, AppState>,
    title: String,
    body: Option<String>,
    labels: Vec<String>,
    assignees: Vec<String>,
    milestone: Option<String>,
    project: Option<u64>,
) -> AppResult<git::Issue> {
    let repo_path = state.require_repo_path()?;
    git::create_issue(&repo_path, &title, body.as_deref(), &labels, &assignees, milestone.as_deref(), project)
}

#[tauri::command]
pub async fn list_labels(state: State<'_, AppState>) -> AppResult<Vec<git::IssueLabel>> {
    let repo_path = state.require_repo_path()?;
    git::list_labels(&repo_path)
}

#[tauri::command]
pub async fn create_label(
    state: State<'_, AppState>,
    name: String,
    color: String,
    description: Option<String>,
) -> AppResult<git::IssueLabel> {
    let repo_path = state.require_repo_path()?;
    git::create_label(&repo_path, &name, &color, description.as_deref())
}

#[tauri::command]
pub async fn list_milestones(state: State<'_, AppState>) -> AppResult<Vec<git::IssueMilestone>> {
    let repo_path = state.require_repo_path()?;
    git::list_milestones(&repo_path)
}

#[tauri::command]
pub async fn list_collaborators(state: State<'_, AppState>) -> AppResult<Vec<git::Collaborator>> {
    let repo_path = state.require_repo_path()?;
    git::list_collaborators(&repo_path)
}

#[tauri::command]
pub async fn edit_issue(
    state: State<'_, AppState>,
    number: u64,
    title: Option<String>,
    body: Option<String>,
    add_labels: Vec<String>,
    remove_labels: Vec<String>,
    add_assignees: Vec<String>,
    remove_assignees: Vec<String>,
    milestone: Option<String>,
) -> AppResult<git::Issue> {
    let repo_path = state.require_repo_path()?;
    git::edit_issue(
        &repo_path,
        number,
        title.as_deref(),
        body.as_deref(),
        &add_labels,
        &remove_labels,
        &add_assignees,
        &remove_assignees,
        milestone.as_deref(),
    )
}

#[tauri::command]
pub async fn close_issue(state: State<'_, AppState>, number: u64) -> AppResult<()> {
    let repo_path = state.require_repo_path()?;
    git::close_issue(&repo_path, number)
}

#[tauri::command]
pub async fn reopen_issue(state: State<'_, AppState>, number: u64) -> AppResult<()> {
    let repo_path = state.require_repo_path()?;
    git::reopen_issue(&repo_path, number)
}

#[tauri::command]
pub async fn list_issue_comments(
    state: State<'_, AppState>,
    number: u64,
) -> AppResult<Vec<git::IssueComment>> {
    let repo_path = state.require_repo_path()?;
    git::list_issue_comments(&repo_path, number)
}

#[tauri::command]
pub async fn add_issue_comment(
    state: State<'_, AppState>,
    number: u64,
    body: String,
) -> AppResult<()> {
    let repo_path = state.require_repo_path()?;
    git::add_issue_comment(&repo_path, number, &body)
}

#[tauri::command]
pub async fn list_github_projects(
    state: State<'_, AppState>,
) -> AppResult<Vec<git::GitHubProject>> {
    let repo_path = state.require_repo_path()?;
    git::list_github_projects(&repo_path)
}
