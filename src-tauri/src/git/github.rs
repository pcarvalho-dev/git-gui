use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

/// Find the gh CLI executable path
fn find_gh_cli() -> Option<PathBuf> {
    // Try common installation paths on Windows
    let common_paths = [
        r"C:\Program Files\GitHub CLI\gh.exe",
        r"C:\Program Files (x86)\GitHub CLI\gh.exe",
    ];

    // Check if user has LOCALAPPDATA
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let user_path = PathBuf::from(&local_app_data).join(r"Programs\GitHub CLI\gh.exe");
        if user_path.exists() {
            return Some(user_path);
        }
    }

    // Check common paths
    for path in &common_paths {
        let p = PathBuf::from(path);
        if p.exists() {
            return Some(p);
        }
    }

    // Try to find in PATH
    if let Ok(output) = Command::new("gh").arg("--version").output() {
        if output.status.success() {
            return Some(PathBuf::from("gh"));
        }
    }

    None
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PullRequest {
    pub number: u64,
    pub title: String,
    pub body: Option<String>,
    pub state: String,
    pub author: String,
    pub head_branch: String,
    pub base_branch: String,
    pub url: String,
    pub html_url: String,
    pub created_at: String,
    pub updated_at: String,
    pub draft: bool,
    pub mergeable: Option<bool>,
    pub additions: u64,
    pub deletions: u64,
    pub changed_files: u64,
    pub reviewers: Vec<String>,
    pub labels: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PullRequestReview {
    pub id: u64,
    pub author: String,
    pub state: String,
    pub body: Option<String>,
    pub submitted_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PullRequestComment {
    pub id: u64,
    pub author: String,
    pub body: String,
    pub path: Option<String>,
    pub line: Option<u64>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PullRequestFile {
    pub filename: String,
    pub status: String,
    pub additions: u64,
    pub deletions: u64,
    pub patch: Option<String>,
}

/// Check if gh CLI is installed and authenticated
pub fn check_gh_cli(repo_path: &Path) -> AppResult<bool> {
    let gh_path = match find_gh_cli() {
        Some(p) => p,
        None => return Ok(false),
    };

    let output = Command::new(&gh_path)
        .args(["auth", "status"])
        .current_dir(repo_path)
        .output();

    match output {
        Ok(o) => Ok(o.status.success()),
        Err(_) => Ok(false),
    }
}

/// Run gh command and return output
fn run_gh_command(repo_path: &Path, args: &[&str]) -> AppResult<String> {
    let gh_path = find_gh_cli().ok_or_else(|| {
        AppError::with_details(
            "GH_NOT_FOUND",
            "GitHub CLI (gh) nao encontrado",
            "Instale em https://cli.github.com",
        )
    })?;

    let output = Command::new(&gh_path)
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| {
            AppError::with_details(
                "GH_COMMAND_FAILED",
                "Falha ao executar GitHub CLI",
                &e.to_string(),
            )
        })?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("not logged") || stderr.contains("auth login") {
            Err(AppError::with_details(
                "GH_NOT_AUTHENTICATED",
                "Voce precisa fazer login no GitHub CLI",
                "Execute 'gh auth login' no terminal",
            ))
        } else {
            Err(AppError::with_details(
                "GH_COMMAND_FAILED",
                "Comando gh falhou",
                stderr.trim(),
            ))
        }
    }
}

/// List pull requests
pub fn list_pull_requests(repo_path: &Path, state: Option<&str>, limit: u32) -> AppResult<Vec<PullRequest>> {
    let state_arg = state.unwrap_or("all");
    let limit_str = limit.to_string();

    let output = run_gh_command(
        repo_path,
        &[
            "pr", "list",
            "--state", state_arg,
            "--limit", &limit_str,
            "--json", "number,title,body,state,author,headRefName,baseRefName,url,createdAt,updatedAt,isDraft,additions,deletions,changedFiles,reviewRequests,labels"
        ],
    )?;

    if output.trim().is_empty() || output.trim() == "[]" {
        return Ok(Vec::new());
    }

    let prs: Vec<serde_json::Value> = serde_json::from_str(&output)
        .map_err(|e| AppError::with_details("PARSE_ERROR", "Erro ao parsear PRs", &e.to_string()))?;

    let result = prs
        .into_iter()
        .map(|pr| PullRequest {
            number: pr["number"].as_u64().unwrap_or(0),
            title: pr["title"].as_str().unwrap_or("").to_string(),
            body: pr["body"].as_str().map(|s| s.to_string()),
            state: pr["state"].as_str().unwrap_or("").to_string(),
            author: pr["author"]["login"].as_str().unwrap_or("").to_string(),
            head_branch: pr["headRefName"].as_str().unwrap_or("").to_string(),
            base_branch: pr["baseRefName"].as_str().unwrap_or("").to_string(),
            url: pr["url"].as_str().unwrap_or("").to_string(),
            html_url: pr["url"].as_str().unwrap_or("").to_string(),
            created_at: pr["createdAt"].as_str().unwrap_or("").to_string(),
            updated_at: pr["updatedAt"].as_str().unwrap_or("").to_string(),
            draft: pr["isDraft"].as_bool().unwrap_or(false),
            mergeable: None,
            additions: pr["additions"].as_u64().unwrap_or(0),
            deletions: pr["deletions"].as_u64().unwrap_or(0),
            changed_files: pr["changedFiles"].as_u64().unwrap_or(0),
            reviewers: pr["reviewRequests"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|r| r["login"].as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default(),
            labels: pr["labels"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|l| l["name"].as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default(),
        })
        .collect();

    Ok(result)
}

/// Get a single pull request by number
pub fn get_pull_request(repo_path: &Path, number: u64) -> AppResult<PullRequest> {
    let number_str = number.to_string();

    let output = run_gh_command(
        repo_path,
        &[
            "pr", "view", &number_str,
            "--json", "number,title,body,state,author,headRefName,baseRefName,url,createdAt,updatedAt,isDraft,mergeable,additions,deletions,changedFiles,reviewRequests,labels"
        ],
    )?;

    let pr: serde_json::Value = serde_json::from_str(&output)
        .map_err(|e| AppError::with_details("PARSE_ERROR", "Erro ao parsear PR", &e.to_string()))?;

    Ok(PullRequest {
        number: pr["number"].as_u64().unwrap_or(0),
        title: pr["title"].as_str().unwrap_or("").to_string(),
        body: pr["body"].as_str().map(|s| s.to_string()),
        state: pr["state"].as_str().unwrap_or("").to_string(),
        author: pr["author"]["login"].as_str().unwrap_or("").to_string(),
        head_branch: pr["headRefName"].as_str().unwrap_or("").to_string(),
        base_branch: pr["baseRefName"].as_str().unwrap_or("").to_string(),
        url: pr["url"].as_str().unwrap_or("").to_string(),
        html_url: pr["url"].as_str().unwrap_or("").to_string(),
        created_at: pr["createdAt"].as_str().unwrap_or("").to_string(),
        updated_at: pr["updatedAt"].as_str().unwrap_or("").to_string(),
        draft: pr["isDraft"].as_bool().unwrap_or(false),
        mergeable: pr["mergeable"].as_str().map(|s| s == "MERGEABLE"),
        additions: pr["additions"].as_u64().unwrap_or(0),
        deletions: pr["deletions"].as_u64().unwrap_or(0),
        changed_files: pr["changedFiles"].as_u64().unwrap_or(0),
        reviewers: pr["reviewRequests"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|r| r["login"].as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default(),
        labels: pr["labels"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|l| l["name"].as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default(),
    })
}

/// Create a new pull request
pub fn create_pull_request(
    repo_path: &Path,
    title: &str,
    body: Option<&str>,
    base: &str,
    head: Option<&str>,
    draft: bool,
) -> AppResult<PullRequest> {
    let mut args = vec!["pr", "create", "--title", title, "--base", base];

    if let Some(b) = body {
        args.extend(["--body", b]);
    }

    if let Some(h) = head {
        args.extend(["--head", h]);
    }

    if draft {
        args.push("--draft");
    }

    let output = run_gh_command(repo_path, &args)?;

    // gh pr create returns the URL, extract PR number
    let url = output.trim();
    let number: u64 = url
        .rsplit('/')
        .next()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    if number == 0 {
        return Err(AppError::new("PR_CREATE_FAILED", "Falha ao criar PR"));
    }

    get_pull_request(repo_path, number)
}

/// Get PR reviews
pub fn get_pull_request_reviews(repo_path: &Path, number: u64) -> AppResult<Vec<PullRequestReview>> {
    let number_str = number.to_string();

    let output = run_gh_command(
        repo_path,
        &[
            "pr", "view", &number_str,
            "--json", "reviews"
        ],
    )?;

    let data: serde_json::Value = serde_json::from_str(&output)
        .map_err(|e| AppError::with_details("PARSE_ERROR", "Erro ao parsear reviews", &e.to_string()))?;

    let reviews = data["reviews"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|r| PullRequestReview {
                    id: r["id"].as_u64().unwrap_or(0),
                    author: r["author"]["login"].as_str().unwrap_or("").to_string(),
                    state: r["state"].as_str().unwrap_or("").to_string(),
                    body: r["body"].as_str().map(|s| s.to_string()),
                    submitted_at: r["submittedAt"].as_str().unwrap_or("").to_string(),
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(reviews)
}

/// Get PR comments
pub fn get_pull_request_comments(repo_path: &Path, number: u64) -> AppResult<Vec<PullRequestComment>> {
    let number_str = number.to_string();

    let output = run_gh_command(
        repo_path,
        &[
            "pr", "view", &number_str,
            "--json", "comments"
        ],
    )?;

    let data: serde_json::Value = serde_json::from_str(&output)
        .map_err(|e| AppError::with_details("PARSE_ERROR", "Erro ao parsear comments", &e.to_string()))?;

    let comments = data["comments"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|c| PullRequestComment {
                    id: c["id"].as_u64().unwrap_or(0),
                    author: c["author"]["login"].as_str().unwrap_or("").to_string(),
                    body: c["body"].as_str().unwrap_or("").to_string(),
                    path: c["path"].as_str().map(|s| s.to_string()),
                    line: c["line"].as_u64(),
                    created_at: c["createdAt"].as_str().unwrap_or("").to_string(),
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(comments)
}

/// Get PR files
pub fn get_pull_request_files(repo_path: &Path, number: u64) -> AppResult<Vec<PullRequestFile>> {
    let number_str = number.to_string();

    let output = run_gh_command(
        repo_path,
        &[
            "pr", "view", &number_str,
            "--json", "files"
        ],
    )?;

    let data: serde_json::Value = serde_json::from_str(&output)
        .map_err(|e| AppError::with_details("PARSE_ERROR", "Erro ao parsear files", &e.to_string()))?;

    let files = data["files"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|f| PullRequestFile {
                    filename: f["path"].as_str().unwrap_or("").to_string(),
                    status: f["additions"].as_u64().map(|_| "modified").unwrap_or("unknown").to_string(),
                    additions: f["additions"].as_u64().unwrap_or(0),
                    deletions: f["deletions"].as_u64().unwrap_or(0),
                    patch: None,
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(files)
}

/// Add a review to PR (approve, request changes, or comment)
pub fn review_pull_request(
    repo_path: &Path,
    number: u64,
    action: &str, // "approve", "request-changes", "comment"
    body: Option<&str>,
) -> AppResult<()> {
    let number_str = number.to_string();
    let mut args = vec!["pr", "review", &number_str];

    match action {
        "approve" => args.push("--approve"),
        "request-changes" => args.push("--request-changes"),
        "comment" => args.push("--comment"),
        _ => return Err(AppError::new("INVALID_ACTION", "Acao de review invalida")),
    }

    if let Some(b) = body {
        args.extend(["--body", b]);
    }

    run_gh_command(repo_path, &args)?;
    Ok(())
}

/// Add a comment to PR
pub fn comment_pull_request(repo_path: &Path, number: u64, body: &str) -> AppResult<()> {
    let number_str = number.to_string();

    run_gh_command(repo_path, &["pr", "comment", &number_str, "--body", body])?;
    Ok(())
}

/// Merge a pull request
pub fn merge_pull_request(
    repo_path: &Path,
    number: u64,
    method: &str, // "merge", "squash", "rebase"
    delete_branch: bool,
) -> AppResult<()> {
    let number_str = number.to_string();
    let mut args = vec!["pr", "merge", &number_str];

    match method {
        "squash" => args.push("--squash"),
        "rebase" => args.push("--rebase"),
        _ => args.push("--merge"),
    }

    if delete_branch {
        args.push("--delete-branch");
    }

    run_gh_command(repo_path, &args)?;
    Ok(())
}

/// Close a pull request without merging
pub fn close_pull_request(repo_path: &Path, number: u64) -> AppResult<()> {
    let number_str = number.to_string();
    run_gh_command(repo_path, &["pr", "close", &number_str])?;
    Ok(())
}

/// Reopen a closed pull request
pub fn reopen_pull_request(repo_path: &Path, number: u64) -> AppResult<()> {
    let number_str = number.to_string();
    run_gh_command(repo_path, &["pr", "reopen", &number_str])?;
    Ok(())
}

/// Mark PR as ready for review (un-draft)
pub fn ready_pull_request(repo_path: &Path, number: u64) -> AppResult<()> {
    let number_str = number.to_string();
    run_gh_command(repo_path, &["pr", "ready", &number_str])?;
    Ok(())
}

/// Get PR diff
pub fn get_pull_request_diff(repo_path: &Path, number: u64) -> AppResult<String> {
    let number_str = number.to_string();
    run_gh_command(repo_path, &["pr", "diff", &number_str])
}

/// Checkout PR branch locally
pub fn checkout_pull_request(repo_path: &Path, number: u64) -> AppResult<()> {
    let number_str = number.to_string();
    run_gh_command(repo_path, &["pr", "checkout", &number_str])?;
    Ok(())
}
