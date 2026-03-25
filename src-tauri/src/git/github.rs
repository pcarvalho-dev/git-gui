use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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
    let mut cmd = Command::new("gh");
    cmd.arg("--version");

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    if let Ok(output) = cmd.output() {
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

    let mut cmd = Command::new(&gh_path);
    cmd.args(["auth", "status"]).current_dir(repo_path);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output();

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

    let mut cmd = Command::new(&gh_path);
    cmd.args(args).current_dir(repo_path);

    // Hide console window on Windows
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|e| {
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
    let body_text = body.unwrap_or("");
    let mut args = vec!["pr", "create", "--title", title, "--body", body_text, "--base", base];

    if let Some(h) = head {
        args.extend(["--head", h]);
    }

    if draft {
        args.push("--draft");
    }

    let output = run_gh_command(repo_path, &args).map_err(|e| {
        // Improve error messages for common PR creation failures
        let details = e.details.clone().unwrap_or_default();

        if details.contains("not found") || details.contains("does not exist") {
            AppError::with_details(
                "PR_CREATE_FAILED",
                "Branch nao encontrada no remote",
                "Faca push da branch antes de criar o PR",
            )
        } else if details.contains("already exists") {
            AppError::with_details(
                "PR_ALREADY_EXISTS",
                "Ja existe um PR para esta branch",
                &details,
            )
        } else if details.contains("no commits") || details.contains("No commits") {
            AppError::with_details(
                "PR_NO_COMMITS",
                "Nao ha commits entre as branches",
                "A branch de origem deve ter commits diferentes da branch de destino",
            )
        } else {
            e
        }
    })?;

    // gh pr create returns the URL, extract PR number
    let url = output.trim();
    let number: u64 = url
        .rsplit('/')
        .next()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    if number == 0 {
        return Err(AppError::with_details(
            "PR_CREATE_FAILED",
            "Falha ao criar PR",
            &format!("Resposta inesperada: {}", output),
        ));
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

// ─────────────────────────────────────────
// Issues
// ─────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IssueLabel {
    pub name: String,
    pub color: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IssueMilestone {
    pub number: u64,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    pub open_issues: u64,
    pub closed_issues: u64,
    pub due_on: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Collaborator {
    pub login: String,
    pub avatar_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Issue {
    pub number: u64,
    pub title: String,
    pub body: Option<String>,
    pub state: String,
    pub author: String,
    pub labels: Vec<IssueLabel>,
    pub assignees: Vec<String>,
    pub milestone_number: Option<u64>,
    pub milestone_title: Option<String>,
    pub url: String,
    pub created_at: String,
    pub updated_at: String,
    pub comments_count: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IssueComment {
    pub id: u64,
    pub author: String,
    pub body: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubProject {
    pub number: u64,
    pub title: String,
    pub url: String,
    pub closed: bool,
}

fn parse_issue(v: &serde_json::Value) -> Issue {
    Issue {
        number: v["number"].as_u64().unwrap_or(0),
        title: v["title"].as_str().unwrap_or("").to_string(),
        body: v["body"].as_str().filter(|s| !s.is_empty()).map(String::from),
        state: v["state"].as_str().unwrap_or("OPEN").to_string(),
        author: v["author"]["login"].as_str().unwrap_or("").to_string(),
        labels: v["labels"]
            .as_array()
            .map(|a| a.iter().map(|l| IssueLabel {
                name: l["name"].as_str().unwrap_or("").to_string(),
                color: l["color"].as_str().unwrap_or("").to_string(),
                description: l["description"].as_str().filter(|s| !s.is_empty()).map(String::from),
            }).collect())
            .unwrap_or_default(),
        assignees: v["assignees"]
            .as_array()
            .map(|a| a.iter().filter_map(|u| u["login"].as_str().map(String::from)).collect())
            .unwrap_or_default(),
        milestone_number: v["milestone"]["number"].as_u64(),
        milestone_title: v["milestone"]["title"].as_str().map(String::from),
        url: v["url"].as_str().unwrap_or("").to_string(),
        created_at: v["createdAt"].as_str().unwrap_or("").to_string(),
        updated_at: v["updatedAt"].as_str().unwrap_or("").to_string(),
        comments_count: v["comments"]["totalCount"].as_u64()
            .or_else(|| v["comments"].as_u64())
            .unwrap_or(0),
    }
}

pub fn list_issues(
    repo_path: &Path,
    state: Option<&str>,
    limit: u32,
    label: Option<&str>,
    assignee: Option<&str>,
    milestone: Option<&str>,
) -> AppResult<Vec<Issue>> {
    let state_arg = state.unwrap_or("open");
    let limit_str = limit.to_string();

    let mut args = vec![
        "issue", "list",
        "--state", state_arg,
        "--limit", &limit_str,
        "--json", "number,title,body,state,author,labels,assignees,milestone,url,createdAt,updatedAt,comments",
    ];

    let label_owned;
    if let Some(l) = label {
        label_owned = l.to_string();
        args.push("--label");
        args.push(&label_owned);
    }

    let assignee_owned;
    if let Some(a) = assignee {
        assignee_owned = a.to_string();
        args.push("--assignee");
        args.push(&assignee_owned);
    }

    let milestone_owned;
    if let Some(m) = milestone {
        milestone_owned = m.to_string();
        args.push("--milestone");
        args.push(&milestone_owned);
    }

    let output = run_gh_command(repo_path, &args)?;

    if output.trim().is_empty() || output.trim() == "[]" {
        return Ok(Vec::new());
    }

    let items: Vec<serde_json::Value> = serde_json::from_str(&output)
        .map_err(|e| AppError::with_details("PARSE_ERROR", "Erro ao parsear issues", &e.to_string()))?;

    Ok(items.iter().map(parse_issue).collect())
}

pub fn get_issue(repo_path: &Path, number: u64) -> AppResult<Issue> {
    let number_str = number.to_string();
    let output = run_gh_command(
        repo_path,
        &["issue", "view", &number_str,
          "--json", "number,title,body,state,author,labels,assignees,milestone,url,createdAt,updatedAt,comments"],
    )?;
    let v: serde_json::Value = serde_json::from_str(&output)
        .map_err(|e| AppError::with_details("PARSE_ERROR", "Erro ao parsear issue", &e.to_string()))?;
    Ok(parse_issue(&v))
}

pub fn create_issue(
    repo_path: &Path,
    title: &str,
    body: Option<&str>,
    labels: &[String],
    assignees: &[String],
    milestone: Option<&str>,
    project: Option<u64>,
) -> AppResult<Issue> {
    let mut args = vec!["issue", "create", "--title", title];

    let body_owned;
    if let Some(b) = body {
        body_owned = b.to_string();
        args.push("--body");
        args.push(&body_owned);
    } else {
        args.push("--body");
        args.push("");
    }

    let milestone_owned;
    if let Some(m) = milestone {
        milestone_owned = m.to_string();
        args.push("--milestone");
        args.push(&milestone_owned);
    }

    let project_owned;
    if let Some(p) = project {
        project_owned = p.to_string();
        args.push("--project");
        args.push(&project_owned);
    }

    let label_args: Vec<String> = labels.iter().flat_map(|l| vec!["--label".to_string(), l.clone()]).collect();
    let label_refs: Vec<&str> = label_args.iter().map(|s| s.as_str()).collect();

    let assignee_args: Vec<String> = assignees.iter().flat_map(|a| vec!["--assignee".to_string(), a.clone()]).collect();
    let assignee_refs: Vec<&str> = assignee_args.iter().map(|s| s.as_str()).collect();

    args.extend_from_slice(&label_refs);
    args.extend_from_slice(&assignee_refs);

    // gh issue create retorna a URL da issue criada no stdout (não suporta --json)
    let output = run_gh_command(repo_path, &args)?;

    // Extrai o número da issue a partir da URL retornada (ex: https://github.com/org/repo/issues/42)
    let issue_number = output
        .lines()
        .find(|l| l.contains("/issues/"))
        .and_then(|url| url.trim().split("/issues/").last())
        .and_then(|n| n.trim().parse::<u64>().ok())
        .ok_or_else(|| AppError::with_details(
            "PARSE_ERROR",
            "Não foi possível obter o número da issue criada",
            output.trim(),
        ))?;

    // Busca os detalhes completos da issue criada
    get_issue(repo_path, issue_number)
}

pub fn list_labels(repo_path: &Path) -> AppResult<Vec<IssueLabel>> {
    let output = run_gh_command(
        repo_path,
        &["label", "list", "--json", "name,color,description", "--limit", "100"],
    )?;

    if output.trim().is_empty() || output.trim() == "[]" {
        return Ok(Vec::new());
    }

    let items: Vec<serde_json::Value> = serde_json::from_str(&output)
        .map_err(|e| AppError::with_details("PARSE_ERROR", "Erro ao parsear labels", &e.to_string()))?;

    Ok(items.iter().map(|l| IssueLabel {
        name: l["name"].as_str().unwrap_or("").to_string(),
        color: l["color"].as_str().unwrap_or("").to_string(),
        description: l["description"].as_str().filter(|s| !s.is_empty()).map(String::from),
    }).collect())
}

pub fn create_label(
    repo_path: &Path,
    name: &str,
    color: &str,
    description: Option<&str>,
) -> AppResult<IssueLabel> {
    // Remove leading # if present
    let color_clean = color.trim_start_matches('#');
    let mut args = vec!["label", "create", name, "--color", color_clean, "--force"];

    let desc_owned;
    if let Some(d) = description {
        desc_owned = d.to_string();
        args.push("--description");
        args.push(&desc_owned);
    }

    run_gh_command(repo_path, &args)?;

    Ok(IssueLabel {
        name: name.to_string(),
        color: color_clean.to_string(),
        description: description.map(String::from),
    })
}

pub fn list_milestones(repo_path: &Path) -> AppResult<Vec<IssueMilestone>> {
    let output = run_gh_command(
        repo_path,
        &["api", "repos/{owner}/{repo}/milestones", "--method", "GET",
          "-f", "state=all", "-f", "per_page=100"],
    );

    let output = match output {
        Ok(o) => o,
        Err(_) => return Ok(Vec::new()),
    };

    if output.trim().is_empty() || output.trim() == "[]" {
        return Ok(Vec::new());
    }

    let items: Vec<serde_json::Value> = serde_json::from_str(&output)
        .unwrap_or_default();

    Ok(items.iter().map(|m| IssueMilestone {
        number: m["number"].as_u64().unwrap_or(0),
        title: m["title"].as_str().unwrap_or("").to_string(),
        description: m["description"].as_str().filter(|s| !s.is_empty()).map(String::from),
        state: m["state"].as_str().unwrap_or("open").to_string(),
        open_issues: m["open_issues"].as_u64().unwrap_or(0),
        closed_issues: m["closed_issues"].as_u64().unwrap_or(0),
        due_on: m["due_on"].as_str().filter(|s| !s.is_empty() && *s != "null").map(String::from),
    }).collect())
}

pub fn list_collaborators(repo_path: &Path) -> AppResult<Vec<Collaborator>> {
    let output = run_gh_command(
        repo_path,
        &["api", "repos/{owner}/{repo}/collaborators", "--method", "GET",
          "-f", "per_page=100"],
    );

    let output = match output {
        Ok(o) => o,
        Err(_) => return Ok(Vec::new()),
    };

    if output.trim().is_empty() || output.trim() == "[]" {
        return Ok(Vec::new());
    }

    let items: Vec<serde_json::Value> = serde_json::from_str(&output)
        .unwrap_or_default();

    Ok(items.iter().map(|c| Collaborator {
        login: c["login"].as_str().unwrap_or("").to_string(),
        avatar_url: c["avatar_url"].as_str().unwrap_or("").to_string(),
    }).collect())
}

pub fn edit_issue(
    repo_path: &Path,
    number: u64,
    title: Option<&str>,
    body: Option<&str>,
    add_labels: &[String],
    remove_labels: &[String],
    add_assignees: &[String],
    remove_assignees: &[String],
    milestone: Option<&str>, // empty string = clear milestone
) -> AppResult<Issue> {
    let number_str = number.to_string();
    let mut args = vec!["issue", "edit", &number_str];

    let title_owned;
    if let Some(t) = title {
        title_owned = t.to_string();
        args.push("--title");
        args.push(&title_owned);
    }

    let body_owned;
    if let Some(b) = body {
        body_owned = b.to_string();
        args.push("--body");
        args.push(&body_owned);
    }

    let milestone_owned;
    if let Some(m) = milestone {
        milestone_owned = m.to_string();
        args.push("--milestone");
        args.push(&milestone_owned);
    }

    let add_label_args: Vec<String> = add_labels.iter()
        .flat_map(|l| vec!["--add-label".to_string(), l.clone()])
        .collect();
    let remove_label_args: Vec<String> = remove_labels.iter()
        .flat_map(|l| vec!["--remove-label".to_string(), l.clone()])
        .collect();
    let add_assignee_args: Vec<String> = add_assignees.iter()
        .flat_map(|a| vec!["--add-assignee".to_string(), a.clone()])
        .collect();
    let remove_assignee_args: Vec<String> = remove_assignees.iter()
        .flat_map(|a| vec!["--remove-assignee".to_string(), a.clone()])
        .collect();

    let all_extra: Vec<&str> = add_label_args.iter()
        .chain(remove_label_args.iter())
        .chain(add_assignee_args.iter())
        .chain(remove_assignee_args.iter())
        .map(|s| s.as_str())
        .collect();

    args.extend_from_slice(&all_extra);

    run_gh_command(repo_path, &args)?;
    get_issue(repo_path, number)
}

pub fn close_issue(repo_path: &Path, number: u64) -> AppResult<()> {
    let number_str = number.to_string();
    run_gh_command(repo_path, &["issue", "close", &number_str])?;
    Ok(())
}

pub fn reopen_issue(repo_path: &Path, number: u64) -> AppResult<()> {
    let number_str = number.to_string();
    run_gh_command(repo_path, &["issue", "reopen", &number_str])?;
    Ok(())
}

pub fn list_issue_comments(repo_path: &Path, number: u64) -> AppResult<Vec<IssueComment>> {
    let number_str = number.to_string();
    let output = run_gh_command(
        repo_path,
        &["issue", "view", &number_str, "--json", "comments"],
    )?;

    let v: serde_json::Value = serde_json::from_str(&output)
        .map_err(|e| AppError::with_details("PARSE_ERROR", "Erro ao parsear comentários", &e.to_string()))?;

    let comments = v["comments"]
        .as_array()
        .map(|arr| {
            arr.iter().map(|c| IssueComment {
                id: c["id"].as_u64().unwrap_or(0),
                author: c["author"]["login"].as_str().unwrap_or("").to_string(),
                body: c["body"].as_str().unwrap_or("").to_string(),
                created_at: c["createdAt"].as_str().unwrap_or("").to_string(),
            }).collect()
        })
        .unwrap_or_default();

    Ok(comments)
}

pub fn add_issue_comment(repo_path: &Path, number: u64, body: &str) -> AppResult<()> {
    let number_str = number.to_string();
    run_gh_command(repo_path, &["issue", "comment", &number_str, "--body", body])?;
    Ok(())
}

pub fn list_github_projects(repo_path: &Path) -> AppResult<Vec<GitHubProject>> {
    let output = run_gh_command(
        repo_path,
        &["project", "list", "--format", "json", "--limit", "30"],
    );

    let output = match output {
        Ok(o) => o,
        Err(_) => return Ok(Vec::new()), // gh project não disponível em versões antigas
    };

    if output.trim().is_empty() {
        return Ok(Vec::new());
    }

    let v: serde_json::Value = serde_json::from_str(&output)
        .unwrap_or(serde_json::Value::Null);

    let projects = v["projects"]
        .as_array()
        .map(|arr| {
            arr.iter().map(|p| GitHubProject {
                number: p["number"].as_u64().unwrap_or(0),
                title: p["title"].as_str().unwrap_or("").to_string(),
                url: p["url"].as_str().unwrap_or("").to_string(),
                closed: p["closed"].as_bool().unwrap_or(false),
            }).collect()
        })
        .unwrap_or_default();

    Ok(projects)
}
