use crate::error::{AppError, AppResult};
use git2::Repository;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RemoteInfo {
    pub name: String,
    pub fetch_url: String,
    pub push_url: String,
}

/// Run a git command in the repository directory
fn run_git_command(repo_path: &Path, args: &[&str]) -> AppResult<String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| AppError::with_details("GIT_COMMAND_FAILED", "Falha ao executar git", &e.to_string()))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(AppError::with_details(
            "GIT_COMMAND_FAILED",
            "Comando git falhou",
            stderr.trim(),
        ))
    }
}

pub fn list_remotes(repo: &Repository) -> AppResult<Vec<RemoteInfo>> {
    let remotes = repo.remotes()?;

    let mut result = Vec::new();

    for name in remotes.iter().flatten() {
        let remote = repo.find_remote(name)?;

        result.push(RemoteInfo {
            name: name.to_string(),
            fetch_url: remote.url().unwrap_or("").to_string(),
            push_url: remote.pushurl().unwrap_or(remote.url().unwrap_or("")).to_string(),
        });
    }

    Ok(result)
}

pub fn add_remote(repo: &Repository, name: &str, url: &str) -> AppResult<()> {
    repo.remote(name, url)?;
    Ok(())
}

pub fn remove_remote(repo: &Repository, name: &str) -> AppResult<()> {
    repo.remote_delete(name)?;
    Ok(())
}

pub fn rename_remote(repo: &Repository, old_name: &str, new_name: &str) -> AppResult<()> {
    repo.remote_rename(old_name, new_name)?;
    Ok(())
}

pub fn fetch(repo: &Repository, remote_name: Option<&str>) -> AppResult<()> {
    let repo_path = repo.path().parent().unwrap_or(repo.path());

    if let Some(name) = remote_name {
        run_git_command(repo_path, &["fetch", name])?;
    } else {
        run_git_command(repo_path, &["fetch", "--all"])?;
    }

    Ok(())
}

pub fn pull(repo: &Repository, remote_name: &str, branch: &str) -> AppResult<String> {
    let repo_path = repo.path().parent().unwrap_or(repo.path());

    let output = run_git_command(repo_path, &["pull", remote_name, branch])?;

    // Parse output to determine result type
    let output_lower = output.to_lowercase();
    if output_lower.contains("already up to date") || output_lower.contains("already up-to-date") {
        Ok("already-up-to-date".to_string())
    } else if output_lower.contains("fast-forward") {
        Ok("fast-forward".to_string())
    } else {
        Ok("merge".to_string())
    }
}

pub fn push(repo: &Repository, remote_name: &str, branch: &str, force: bool) -> AppResult<()> {
    let repo_path = repo.path().parent().unwrap_or(repo.path());

    let mut args = vec!["push", remote_name, branch];
    if force {
        args.push("--force");
    }

    run_git_command(repo_path, &args)?;
    Ok(())
}

pub fn set_upstream(repo: &Repository, branch: &str, remote: &str, remote_branch: &str) -> AppResult<()> {
    let mut local_branch = repo.find_branch(branch, git2::BranchType::Local)?;
    let upstream_name = format!("{}/{}", remote, remote_branch);
    local_branch.set_upstream(Some(&upstream_name))?;
    Ok(())
}
