use crate::error::{AppError, AppResult};
use git2::Repository;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoInfo {
    pub path: String,
    pub name: String,
    pub is_repo: bool,
    pub is_bare: bool,
    pub current_branch: Option<String>,
    pub has_remote: bool,
    pub is_empty: bool,
}

#[allow(dead_code)]
pub fn open_repository(path: &Path) -> AppResult<Repository> {
    if !path.exists() {
        return Err(AppError::repo_not_found(&path.to_string_lossy()));
    }
    Repository::open(path).map_err(|_| AppError::invalid_repo(&path.to_string_lossy()))
}

pub fn get_repo_info(path: &Path) -> AppResult<RepoInfo> {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());

    let repo = match Repository::open(path) {
        Ok(r) => r,
        Err(_) => {
            return Ok(RepoInfo {
                path: path.to_string_lossy().to_string(),
                name,
                is_repo: false,
                is_bare: false,
                current_branch: None,
                has_remote: false,
                is_empty: true,
            });
        }
    };

    let current_branch = repo.head().ok().and_then(|h| h.shorthand().map(String::from));

    let has_remote = repo.remotes().map(|r| !r.is_empty()).unwrap_or(false);

    let is_empty = repo.is_empty().unwrap_or(true);

    Ok(RepoInfo {
        path: path.to_string_lossy().to_string(),
        name,
        is_repo: true,
        is_bare: repo.is_bare(),
        current_branch,
        has_remote,
        is_empty,
    })
}

pub fn init_repository(path: &Path, bare: bool) -> AppResult<Repository> {
    if bare {
        Repository::init_bare(path).map_err(AppError::from)
    } else {
        Repository::init(path).map_err(AppError::from)
    }
}

pub fn clone_repository(url: &str, path: &Path) -> AppResult<Repository> {
    Repository::clone(url, path).map_err(AppError::from)
}

pub fn get_git_config(repo: &Repository, key: &str) -> Option<String> {
    repo.config()
        .ok()
        .and_then(|c| c.get_string(key).ok())
}

pub fn set_git_config(repo: &Repository, key: &str, value: &str) -> AppResult<()> {
    let mut config = repo.config().map_err(AppError::from)?;
    config.set_str(key, value).map_err(AppError::from)
}
