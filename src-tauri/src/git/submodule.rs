use crate::error::{AppError, AppResult};
use git2::{Repository, SubmoduleIgnore};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubmoduleInfo {
    pub name: String,
    pub path: String,
    pub url: Option<String>,
    pub head_commit: Option<String>,
    pub status: String,
}

pub fn list_submodules(repo: &Repository) -> AppResult<Vec<SubmoduleInfo>> {
    let submodules = repo.submodules()?;
    let mut result = Vec::new();

    for sub in &submodules {
        let name = sub.name().unwrap_or("").to_string();
        let path = sub.path().to_string_lossy().to_string();
        let url = sub.url().map(String::from);
        let head_commit = sub.head_id().map(|o| o.to_string());

        let status = if let Ok(s) = repo.submodule_status(&name, SubmoduleIgnore::None) {
            if !s.contains(git2::SubmoduleStatus::IN_WD) {
                "uninitialized"
            } else if s.intersects(
                git2::SubmoduleStatus::WD_MODIFIED
                    | git2::SubmoduleStatus::WD_INDEX_MODIFIED
                    | git2::SubmoduleStatus::WD_WD_MODIFIED
                    | git2::SubmoduleStatus::WD_UNTRACKED,
            ) {
                "modified"
            } else if s.contains(git2::SubmoduleStatus::INDEX_MODIFIED) {
                "out_of_sync"
            } else {
                "clean"
            }
        } else {
            "uninitialized"
        }
        .to_string();

        result.push(SubmoduleInfo {
            name,
            path,
            url,
            head_commit,
            status,
        });
    }

    Ok(result)
}

fn run_git(repo_path: &str, args: &[&str]) -> AppResult<String> {
    let output = std::process::Command::new("git")
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| AppError::with_details("GIT_NOT_FOUND", "git não encontrado", &e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(AppError::with_details("GIT_ERROR", "Erro no git", &stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn update_submodule(repo_path: &str, name: &str) -> AppResult<()> {
    run_git(repo_path, &["submodule", "update", "--init", "--recursive", "--", name])?;
    Ok(())
}

pub fn add_submodule(repo_path: &str, url: &str, path: &str) -> AppResult<SubmoduleInfo> {
    run_git(repo_path, &["submodule", "add", url, path])?;

    let repo = Repository::open(repo_path)?;
    let sub = repo
        .find_submodule(path)
        .map_err(|_| AppError::with_details("NOT_FOUND", "Submodulo não encontrado após adição", path))?;

    Ok(SubmoduleInfo {
        name: sub.name().unwrap_or(path).to_string(),
        path: sub.path().to_string_lossy().to_string(),
        url: sub.url().map(String::from),
        head_commit: sub.head_id().map(|o| o.to_string()),
        status: "clean".to_string(),
    })
}

pub fn remove_submodule(repo_path: &str, name: &str) -> AppResult<()> {
    run_git(repo_path, &["rm", "--force", name])?;

    // Remove cached .git/modules/<name>
    let modules_dir = std::path::Path::new(repo_path)
        .join(".git")
        .join("modules")
        .join(name);
    if modules_dir.exists() {
        let _ = std::fs::remove_dir_all(&modules_dir);
    }

    Ok(())
}
