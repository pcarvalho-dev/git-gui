use crate::error::{AppError, AppResult};
use git2::{BranchType, Repository};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub is_head: bool,
    pub commit_hash: Option<String>,
    pub commit_message: Option<String>,
    pub upstream: Option<String>,
    pub ahead: Option<usize>,
    pub behind: Option<usize>,
    pub author_name: Option<String>,
    pub author_email: Option<String>,
    pub commit_date: Option<i64>,
}

pub fn list_branches(repo: &Repository) -> AppResult<Vec<BranchInfo>> {
    let current_branch = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(String::from));

    let mut branches = Vec::new();

    // Local branches
    for branch in repo.branches(Some(BranchType::Local))? {
        let (branch, _) = branch?;
        let name = branch.name()?.unwrap_or("").to_string();
        let reference = branch.get();
        let commit_hash = reference.target().map(|oid| oid.to_string()[..7].to_string());

        let commit = reference.peel_to_commit().ok();
        let commit_message = commit.as_ref().and_then(|c| c.summary().map(String::from));
        let author_name = commit.as_ref().map(|c| c.author().name().unwrap_or("").to_string());
        let author_email = commit.as_ref().map(|c| c.author().email().unwrap_or("").to_string());
        let commit_date = commit.as_ref().map(|c| c.time().seconds());

        let upstream = branch
            .upstream()
            .ok()
            .and_then(|u| u.name().ok().flatten().map(String::from));

        let (ahead, behind) = if let Some(ref _upstream_name) = upstream {
            calculate_ahead_behind(repo, &name).unwrap_or((None, None))
        } else {
            (None, None)
        };

        branches.push(BranchInfo {
            name: name.clone(),
            is_current: current_branch.as_ref() == Some(&name),
            is_remote: false,
            is_head: reference.is_branch(),
            commit_hash,
            commit_message,
            upstream,
            ahead,
            behind,
            author_name,
            author_email,
            commit_date,
        });
    }

    // Remote branches
    for branch in repo.branches(Some(BranchType::Remote))? {
        let (branch, _) = branch?;
        let name = branch.name()?.unwrap_or("").to_string();

        // Skip HEAD references
        if name.ends_with("/HEAD") {
            continue;
        }

        let reference = branch.get();
        let commit_hash = reference.target().map(|oid| oid.to_string()[..7].to_string());

        let commit = reference.peel_to_commit().ok();
        let commit_message = commit.as_ref().and_then(|c| c.summary().map(String::from));
        let author_name = commit.as_ref().map(|c| c.author().name().unwrap_or("").to_string());
        let author_email = commit.as_ref().map(|c| c.author().email().unwrap_or("").to_string());
        let commit_date = commit.as_ref().map(|c| c.time().seconds());

        branches.push(BranchInfo {
            name,
            is_current: false,
            is_remote: true,
            is_head: false,
            commit_hash,
            commit_message,
            upstream: None,
            ahead: None,
            behind: None,
            author_name,
            author_email,
            commit_date,
        });
    }

    // Sort: current first, then local, then remote
    branches.sort_by(|a, b| {
        if a.is_current != b.is_current {
            return b.is_current.cmp(&a.is_current);
        }
        if a.is_remote != b.is_remote {
            return a.is_remote.cmp(&b.is_remote);
        }
        a.name.cmp(&b.name)
    });

    Ok(branches)
}

fn calculate_ahead_behind(repo: &Repository, branch_name: &str) -> AppResult<(Option<usize>, Option<usize>)> {
    let branch = repo.find_branch(branch_name, BranchType::Local)?;
    let upstream = match branch.upstream() {
        Ok(u) => u,
        Err(_) => return Ok((None, None)),
    };

    let local_oid = branch.get().target().ok_or_else(|| AppError::internal("No local target"))?;
    let upstream_oid = upstream.get().target().ok_or_else(|| AppError::internal("No upstream target"))?;

    let (ahead, behind) = repo.graph_ahead_behind(local_oid, upstream_oid)?;
    Ok((Some(ahead), Some(behind)))
}

pub fn get_current_branch(repo: &Repository) -> AppResult<String> {
    let head = repo.head()?;
    Ok(head.shorthand().unwrap_or("HEAD").to_string())
}

pub fn create_branch(repo: &Repository, name: &str, checkout: bool) -> AppResult<()> {
    // Check if branch exists
    if repo.find_branch(name, BranchType::Local).is_ok() {
        return Err(AppError::branch_already_exists(name));
    }

    let head = repo.head()?;
    let commit = head.peel_to_commit()?;

    repo.branch(name, &commit, false)?;

    if checkout {
        checkout_branch(repo, name)?;
    }

    Ok(())
}

pub fn checkout_branch(repo: &Repository, name: &str) -> AppResult<()> {
    let (reference, is_remote) = if let Ok(branch) = repo.find_branch(name, BranchType::Local) {
        (branch.into_reference(), false)
    } else if let Ok(branch) = repo.find_branch(name, BranchType::Remote) {
        (branch.into_reference(), true)
    } else {
        return Err(AppError::branch_not_found(name));
    };

    // Use force checkout - let git handle conflicts
    let mut checkout_opts = git2::build::CheckoutBuilder::new();
    checkout_opts.force();

    if is_remote {
        // Create local branch from remote
        let short_name = name.split('/').last().unwrap_or(name);
        let commit = reference.peel_to_commit().map_err(|e| {
            AppError::with_details("CHECKOUT_ERROR", "Erro ao obter commit da branch", &e.message().to_string())
        })?;

        // Check if local branch already exists
        let local_ref = format!("refs/heads/{}", short_name);
        if repo.find_branch(short_name, BranchType::Local).is_ok() {
            // Local branch exists, just checkout to it
            let reference = repo.find_reference(&local_ref).map_err(|e| {
                AppError::with_details("CHECKOUT_ERROR", "Erro ao encontrar referência local", &e.message().to_string())
            })?;
            let commit = reference.peel_to_commit().map_err(|e| {
                AppError::with_details("CHECKOUT_ERROR", "Erro ao obter commit", &e.message().to_string())
            })?;
            repo.checkout_tree(commit.as_object(), Some(&mut checkout_opts)).map_err(|e| {
                AppError::with_details("CHECKOUT_ERROR", "Erro ao fazer checkout", &e.message().to_string())
            })?;
            repo.set_head(&local_ref).map_err(|e| {
                AppError::with_details("CHECKOUT_ERROR", "Erro ao definir HEAD", &e.message().to_string())
            })?;
        } else {
            // Create new local branch from remote
            repo.branch(short_name, &commit, false).map_err(|e| {
                AppError::with_details("CHECKOUT_ERROR", "Erro ao criar branch local", &e.message().to_string())
            })?;
            let reference = repo.find_reference(&local_ref).map_err(|e| {
                AppError::with_details("CHECKOUT_ERROR", "Erro ao encontrar referência", &e.message().to_string())
            })?;
            let commit = reference.peel_to_commit().map_err(|e| {
                AppError::with_details("CHECKOUT_ERROR", "Erro ao obter commit", &e.message().to_string())
            })?;
            repo.checkout_tree(commit.as_object(), Some(&mut checkout_opts)).map_err(|e| {
                AppError::with_details("CHECKOUT_ERROR", "Erro ao fazer checkout", &e.message().to_string())
            })?;
            repo.set_head(&local_ref).map_err(|e| {
                AppError::with_details("CHECKOUT_ERROR", "Erro ao definir HEAD", &e.message().to_string())
            })?;
        }
    } else {
        let commit = reference.peel_to_commit().map_err(|e| {
            AppError::with_details("CHECKOUT_ERROR", "Erro ao obter commit da branch", &e.message().to_string())
        })?;
        repo.checkout_tree(commit.as_object(), Some(&mut checkout_opts)).map_err(|e| {
            AppError::with_details("CHECKOUT_ERROR", "Erro ao fazer checkout", &e.message().to_string())
        })?;

        let ref_name = format!("refs/heads/{}", name);
        repo.set_head(&ref_name).map_err(|e| {
            AppError::with_details("CHECKOUT_ERROR", "Erro ao definir HEAD", &e.message().to_string())
        })?;
    }

    Ok(())
}

pub fn delete_branch(repo: &Repository, name: &str, force: bool) -> AppResult<()> {
    let current = get_current_branch(repo)?;
    if current == name {
        return Err(AppError::cannot_delete_current_branch());
    }

    let mut branch = repo.find_branch(name, BranchType::Local)?;

    if force {
        branch.delete()?;
    } else {
        // Check if branch is merged
        let branch_commit = branch.get().peel_to_commit()?;
        let head_commit = repo.head()?.peel_to_commit()?;

        if repo.merge_base(branch_commit.id(), head_commit.id()).is_err() {
            return Err(AppError::with_details(
                "BRANCH_NOT_MERGED",
                "Branch não foi merged",
                "Use force delete para deletar mesmo assim",
            ));
        }
        branch.delete()?;
    }

    Ok(())
}

pub fn rename_branch(repo: &Repository, old_name: &str, new_name: &str) -> AppResult<()> {
    let mut branch = repo.find_branch(old_name, BranchType::Local)?;
    branch.rename(new_name, false)?;
    Ok(())
}

pub fn merge_branch(repo: &Repository, branch_name: &str) -> AppResult<String> {
    let branch_ref = format!("refs/heads/{}", branch_name);
    let branch_oid = repo.refname_to_id(&branch_ref)?;
    let branch_commit = repo.find_commit(branch_oid)?;

    let head = repo.head()?;
    let head_commit = head.peel_to_commit()?;

    // Check if it's a fast-forward merge
    let merge_base = repo.merge_base(head_commit.id(), branch_commit.id())?;

    if merge_base == head_commit.id() {
        // Fast-forward
        let reflog_msg = format!("merge {}: Fast-forward", branch_name);
        repo.reference(
            head.name().unwrap_or("HEAD"),
            branch_commit.id(),
            true,
            &reflog_msg,
        )?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))?;
        return Ok("fast-forward".to_string());
    }

    // Regular merge
    let signature = repo.signature()?;
    let mut index = repo.merge_commits(&head_commit, &branch_commit, None)?;

    if index.has_conflicts() {
        // Write conflicts to index
        let conflicts: Vec<_> = index.conflicts()?.collect();
        let mut repo_index = repo.index()?;

        for conflict in conflicts.into_iter().flatten() {
            if let Some(their) = conflict.their {
                repo_index.add(&their)?;
            }
        }
        repo_index.write()?;

        return Err(AppError::merge_conflict());
    }

    let tree_id = index.write_tree_to(repo)?;
    let tree = repo.find_tree(tree_id)?;

    let message = format!("Merge branch '{}'", branch_name);
    let commit_id = repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &message,
        &tree,
        &[&head_commit, &branch_commit],
    )?;

    Ok(commit_id.to_string()[..7].to_string())
}
