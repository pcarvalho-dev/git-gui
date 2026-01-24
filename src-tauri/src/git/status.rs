use crate::error::{AppError, AppResult};
use git2::{BranchType, Repository, StatusOptions};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileStatus {
    pub path: String,
    pub status: FileStatusType,
    pub is_binary: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FileStatusType {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    Untracked,
    Ignored,
    Conflicted,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoStatus {
    pub current_branch: String,
    pub head_commit: Option<String>,
    pub staged_files: Vec<FileStatus>,
    pub unstaged_files: Vec<FileStatus>,
    pub untracked_files: Vec<String>,
    pub conflicted_files: Vec<String>,
    pub ahead: usize,
    pub behind: usize,
    pub is_rebasing: bool,
    pub is_merging: bool,
    pub is_cherry_picking: bool,
}

pub fn get_status(repo: &Repository) -> AppResult<RepoStatus> {
    let head = repo.head().ok();

    let current_branch = head
        .as_ref()
        .and_then(|h| h.shorthand().map(String::from))
        .unwrap_or_else(|| "HEAD".to_string());

    let head_commit = head
        .as_ref()
        .and_then(|h| h.target())
        .map(|oid| oid.to_string()[..7].to_string());

    let mut status_opts = StatusOptions::new();
    status_opts
        .include_untracked(true)
        .include_ignored(false)
        .recurse_untracked_dirs(true);

    let statuses = repo.statuses(Some(&mut status_opts))?;

    let mut staged_files = Vec::new();
    let mut unstaged_files = Vec::new();
    let mut untracked_files = Vec::new();
    let mut conflicted_files = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let status = entry.status();

        // Conflicted
        if status.is_conflicted() {
            conflicted_files.push(path.clone());
            continue;
        }

        // Staged changes
        if status.is_index_new() {
            staged_files.push(FileStatus {
                path: path.clone(),
                status: FileStatusType::Added,
                is_binary: false,
            });
        } else if status.is_index_modified() {
            staged_files.push(FileStatus {
                path: path.clone(),
                status: FileStatusType::Modified,
                is_binary: false,
            });
        } else if status.is_index_deleted() {
            staged_files.push(FileStatus {
                path: path.clone(),
                status: FileStatusType::Deleted,
                is_binary: false,
            });
        } else if status.is_index_renamed() {
            staged_files.push(FileStatus {
                path: path.clone(),
                status: FileStatusType::Renamed,
                is_binary: false,
            });
        }

        // Unstaged changes
        if status.is_wt_new() {
            untracked_files.push(path);
        } else if status.is_wt_modified() {
            unstaged_files.push(FileStatus {
                path: path.clone(),
                status: FileStatusType::Modified,
                is_binary: false,
            });
        } else if status.is_wt_deleted() {
            unstaged_files.push(FileStatus {
                path,
                status: FileStatusType::Deleted,
                is_binary: false,
            });
        }
    }

    // Get ahead/behind
    let (ahead, behind) = get_ahead_behind(repo).unwrap_or((0, 0));

    // Check repo state
    let state = repo.state();
    let is_rebasing = matches!(
        state,
        git2::RepositoryState::Rebase
            | git2::RepositoryState::RebaseInteractive
            | git2::RepositoryState::RebaseMerge
    );
    let is_merging = state == git2::RepositoryState::Merge;
    let is_cherry_picking = state == git2::RepositoryState::CherryPick;

    Ok(RepoStatus {
        current_branch,
        head_commit,
        staged_files,
        unstaged_files,
        untracked_files,
        conflicted_files,
        ahead,
        behind,
        is_rebasing,
        is_merging,
        is_cherry_picking,
    })
}

fn get_ahead_behind(repo: &Repository) -> AppResult<(usize, usize)> {
    let head = repo.head()?;
    let head_oid = head.target().ok_or_else(|| AppError::internal("No HEAD"))?;

    let branch_name = head.shorthand().unwrap_or("HEAD");
    let branch = match repo.find_branch(branch_name, BranchType::Local) {
        Ok(b) => b,
        Err(_) => return Ok((0, 0)),
    };

    let upstream = match branch.upstream() {
        Ok(u) => u,
        Err(_) => return Ok((0, 0)),
    };

    let upstream_oid = upstream
        .get()
        .target()
        .ok_or_else(|| AppError::internal("No upstream target"))?;

    repo.graph_ahead_behind(head_oid, upstream_oid)
        .map_err(AppError::from)
}
