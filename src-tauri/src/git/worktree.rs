use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorktreeInfo {
    pub name: String,
    pub path: String,
    pub branch: Option<String>,
    pub head: String,
    pub is_main: bool,
    pub is_bare: bool,
    pub is_locked: bool,
    pub lock_reason: Option<String>,
}

pub fn list_worktrees(repo_path: &PathBuf) -> AppResult<Vec<WorktreeInfo>> {
    let output = Command::new("git")
        .current_dir(repo_path)
        .args(["worktree", "list", "--porcelain"])
        .output()
        .map_err(|e| AppError::internal(&format!("Falha ao executar git: {}", e)))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::internal(&format!("git worktree list falhou: {}", err)));
    }

    let text = String::from_utf8_lossy(&output.stdout);
    parse_worktree_porcelain(&text, repo_path)
}

fn parse_worktree_porcelain(text: &str, main_path: &PathBuf) -> AppResult<Vec<WorktreeInfo>> {
    let mut worktrees = Vec::new();
    let mut current: Option<WorktreeBuilder> = None;

    for line in text.lines() {
        if line.starts_with("worktree ") {
            if let Some(b) = current.take() {
                worktrees.push(b.build(main_path));
            }
            current = Some(WorktreeBuilder {
                path: line["worktree ".len()..].to_string(),
                head: String::new(),
                branch: None,
                is_bare: false,
                is_locked: false,
                lock_reason: None,
            });
        } else if let Some(ref mut b) = current {
            if let Some(head) = line.strip_prefix("HEAD ") {
                b.head = head[..7.min(head.len())].to_string();
            } else if let Some(branch) = line.strip_prefix("branch ") {
                b.branch = Some(
                    branch
                        .strip_prefix("refs/heads/")
                        .unwrap_or(branch)
                        .to_string(),
                );
            } else if line == "bare" {
                b.is_bare = true;
            } else if line.starts_with("locked") {
                b.is_locked = true;
                let reason = line.strip_prefix("locked").unwrap_or("").trim();
                if !reason.is_empty() {
                    b.lock_reason = Some(reason.to_string());
                }
            }
        }
    }

    if let Some(b) = current {
        worktrees.push(b.build(main_path));
    }

    Ok(worktrees)
}

struct WorktreeBuilder {
    path: String,
    head: String,
    branch: Option<String>,
    is_bare: bool,
    is_locked: bool,
    lock_reason: Option<String>,
}

impl WorktreeBuilder {
    fn build(self, main_path: &PathBuf) -> WorktreeInfo {
        let wt_path = PathBuf::from(&self.path);
        let is_main = wt_path == *main_path;
        let name = if is_main {
            "main".to_string()
        } else {
            wt_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| self.path.clone())
        };

        WorktreeInfo {
            name,
            path: self.path,
            branch: self.branch,
            head: self.head,
            is_main,
            is_bare: self.is_bare,
            is_locked: self.is_locked,
            lock_reason: self.lock_reason,
        }
    }
}

pub fn add_worktree(
    repo_path: &PathBuf,
    path: &str,
    branch: &str,
    create_branch: bool,
) -> AppResult<WorktreeInfo> {
    let mut args = vec!["worktree", "add"];
    if create_branch {
        args.push("-b");
        args.push(branch);
        args.push(path);
    } else {
        args.push(path);
        args.push(branch);
    }

    let output = Command::new("git")
        .current_dir(repo_path)
        .args(&args)
        .output()
        .map_err(|e| AppError::internal(&format!("Falha ao executar git: {}", e)))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::with_details(
            "WORKTREE_ADD_FAILED",
            "Falha ao criar worktree",
            err.trim(),
        ));
    }

    let worktrees = list_worktrees(repo_path)?;
    let abs_path = std::fs::canonicalize(path).unwrap_or_else(|_| PathBuf::from(path));
    worktrees
        .into_iter()
        .find(|w| PathBuf::from(&w.path) == abs_path || w.path == path)
        .ok_or_else(|| AppError::internal("Worktree criado mas nao encontrado na lista"))
}

pub fn remove_worktree(repo_path: &PathBuf, path: &str, force: bool) -> AppResult<()> {
    let mut args = vec!["worktree", "remove"];
    if force {
        args.push("--force");
    }
    args.push(path);

    let output = Command::new("git")
        .current_dir(repo_path)
        .args(&args)
        .output()
        .map_err(|e| AppError::internal(&format!("Falha ao executar git: {}", e)))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::with_details(
            "WORKTREE_REMOVE_FAILED",
            "Falha ao remover worktree",
            err.trim(),
        ));
    }

    Ok(())
}

pub fn lock_worktree(repo_path: &PathBuf, path: &str, reason: Option<&str>) -> AppResult<()> {
    let mut args = vec!["worktree", "lock"];
    if let Some(r) = reason {
        args.push("--reason");
        args.push(r);
    }
    args.push(path);

    let output = Command::new("git")
        .current_dir(repo_path)
        .args(&args)
        .output()
        .map_err(|e| AppError::internal(&format!("Falha ao executar git: {}", e)))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::with_details(
            "WORKTREE_LOCK_FAILED",
            "Falha ao travar worktree",
            err.trim(),
        ));
    }

    Ok(())
}

pub fn unlock_worktree(repo_path: &PathBuf, path: &str) -> AppResult<()> {
    let output = Command::new("git")
        .current_dir(repo_path)
        .args(["worktree", "unlock", path])
        .output()
        .map_err(|e| AppError::internal(&format!("Falha ao executar git: {}", e)))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::with_details(
            "WORKTREE_UNLOCK_FAILED",
            "Falha ao destravar worktree",
            err.trim(),
        ));
    }

    Ok(())
}
