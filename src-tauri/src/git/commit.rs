use crate::error::{AppError, AppResult};
use git2::{Oid, Repository};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub summary: String,
    pub body: Option<String>,
    pub author_name: String,
    pub author_email: String,
    pub author_date: i64,
    pub committer_name: String,
    pub committer_email: String,
    pub committer_date: i64,
    pub parents: Vec<String>,
    pub is_merge: bool,
}

pub fn list_commits(
    repo: &Repository,
    branch: Option<&str>,
    limit: usize,
    skip: usize,
) -> AppResult<Vec<CommitInfo>> {
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(git2::Sort::TIME | git2::Sort::TOPOLOGICAL)?;

    if let Some(branch_name) = branch {
        let branch_ref = format!("refs/heads/{}", branch_name);
        if let Ok(oid) = repo.refname_to_id(&branch_ref) {
            revwalk.push(oid)?;
        } else {
            // Try remote branch
            let remote_ref = format!("refs/remotes/origin/{}", branch_name);
            if let Ok(oid) = repo.refname_to_id(&remote_ref) {
                revwalk.push(oid)?;
            }
        }
    } else {
        revwalk.push_head()?;
    }

    let mut commits = Vec::new();
    let mut count = 0;

    for oid in revwalk {
        let oid = oid?;

        if count < skip {
            count += 1;
            continue;
        }

        if commits.len() >= limit {
            break;
        }

        let commit = repo.find_commit(oid)?;
        commits.push(commit_to_info(&commit));
        count += 1;
    }

    Ok(commits)
}

pub fn get_commit(repo: &Repository, hash: &str) -> AppResult<CommitInfo> {
    let oid = Oid::from_str(hash).map_err(|_| AppError::commit_not_found(hash))?;
    let commit = repo
        .find_commit(oid)
        .map_err(|_| AppError::commit_not_found(hash))?;
    Ok(commit_to_info(&commit))
}

fn commit_to_info(commit: &git2::Commit) -> CommitInfo {
    let hash = commit.id().to_string();
    let message = commit.message().unwrap_or("").to_string();
    let summary = commit.summary().unwrap_or("").to_string();
    let body = message
        .lines()
        .skip(1)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();

    CommitInfo {
        hash: hash.clone(),
        short_hash: hash[..7.min(hash.len())].to_string(),
        message,
        summary,
        body: if body.is_empty() { None } else { Some(body) },
        author_name: commit.author().name().unwrap_or("").to_string(),
        author_email: commit.author().email().unwrap_or("").to_string(),
        author_date: commit.author().when().seconds(),
        committer_name: commit.committer().name().unwrap_or("").to_string(),
        committer_email: commit.committer().email().unwrap_or("").to_string(),
        committer_date: commit.committer().when().seconds(),
        parents: commit.parent_ids().map(|id| id.to_string()).collect(),
        is_merge: commit.parent_count() > 1,
    }
}

pub fn create_commit(repo: &Repository, message: &str, amend: bool) -> AppResult<String> {
    let signature = repo
        .signature()
        .map_err(|_| AppError::git_user_not_configured())?;

    let mut index = repo.index()?;

    // Check if there are staged changes
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    if amend {
        let head = repo.head()?;
        let head_commit = head.peel_to_commit()?;
        let parents: Vec<git2::Commit> = head_commit.parents().collect();
        let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

        let commit_id = repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            message,
            &tree,
            &parent_refs,
        )?;

        Ok(commit_id.to_string()[..7].to_string())
    } else {
        let head = repo.head();

        let commit_id = if let Ok(head_ref) = head {
            let head_commit = head_ref.peel_to_commit()?;
            repo.commit(
                Some("HEAD"),
                &signature,
                &signature,
                message,
                &tree,
                &[&head_commit],
            )?
        } else {
            // Initial commit
            repo.commit(Some("HEAD"), &signature, &signature, message, &tree, &[])?
        };

        Ok(commit_id.to_string()[..7].to_string())
    }
}

pub fn stage_files(repo: &Repository, files: &[String], repo_path: &PathBuf) -> AppResult<()> {
    let mut index = repo.index()?;

    for file in files {
        let full_path = repo_path.join(file);
        if full_path.exists() {
            index.add_path(std::path::Path::new(file))?;
        } else {
            // File was deleted
            index.remove_path(std::path::Path::new(file))?;
        }
    }

    index.write()?;
    Ok(())
}

pub fn unstage_files(repo: &Repository, files: &[String]) -> AppResult<()> {
    let head_tree = repo
        .head()
        .ok()
        .and_then(|h| h.peel_to_tree().ok());

    let mut index = repo.index()?;

    for file in files {
        let path = std::path::Path::new(file);

        if let Some(ref tree) = head_tree {
            if let Ok(entry) = tree.get_path(path) {
                // Restore to HEAD version
                let obj = entry.to_object(repo)?;
                let blob = obj.as_blob().ok_or_else(|| AppError::internal("Not a blob"))?;

                index.add_frombuffer(
                    &git2::IndexEntry {
                        ctime: git2::IndexTime::new(0, 0),
                        mtime: git2::IndexTime::new(0, 0),
                        dev: 0,
                        ino: 0,
                        mode: entry.filemode() as u32,
                        uid: 0,
                        gid: 0,
                        file_size: blob.content().len() as u32,
                        id: entry.id(),
                        flags: 0,
                        flags_extended: 0,
                        path: file.as_bytes().to_vec(),
                    },
                    blob.content(),
                )?;
            } else {
                // File is new, remove from index
                index.remove_path(path)?;
            }
        } else {
            // No HEAD, remove from index
            index.remove_path(path)?;
        }
    }

    index.write()?;
    Ok(())
}

pub fn stage_all(repo: &Repository) -> AppResult<()> {
    let mut index = repo.index()?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;
    Ok(())
}

pub fn unstage_all(repo: &Repository) -> AppResult<()> {
    let head = repo.head()?;
    let commit = head.peel_to_commit()?;
    let tree = commit.tree()?;

    repo.reset(tree.as_object(), git2::ResetType::Mixed, None)?;
    Ok(())
}

pub fn discard_changes(repo: &Repository, files: &[String]) -> AppResult<()> {
    let mut checkout_builder = git2::build::CheckoutBuilder::new();
    checkout_builder.force();

    for file in files {
        checkout_builder.path(file);
    }

    repo.checkout_head(Some(&mut checkout_builder))?;
    Ok(())
}

pub fn cherry_pick(repo: &Repository, commit_hash: &str) -> AppResult<String> {
    let oid = Oid::from_str(commit_hash).map_err(|_| AppError::commit_not_found(commit_hash))?;
    let commit = repo.find_commit(oid)?;

    repo.cherrypick(&commit, None)?;

    // Check for conflicts
    let index = repo.index()?;
    if index.has_conflicts() {
        return Err(AppError::merge_conflict());
    }

    // Create the commit
    let signature = repo.signature()?;
    let tree_id = repo.index()?.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let head = repo.head()?.peel_to_commit()?;

    let new_commit_id = repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        commit.message().unwrap_or(""),
        &tree,
        &[&head],
    )?;

    // Cleanup
    repo.cleanup_state()?;

    Ok(new_commit_id.to_string()[..7].to_string())
}

pub fn revert_commit(repo: &Repository, commit_hash: &str) -> AppResult<String> {
    let oid = Oid::from_str(commit_hash).map_err(|_| AppError::commit_not_found(commit_hash))?;
    let commit = repo.find_commit(oid)?;

    repo.revert(&commit, None)?;

    // Check for conflicts
    let index = repo.index()?;
    if index.has_conflicts() {
        return Err(AppError::merge_conflict());
    }

    // Create the commit
    let signature = repo.signature()?;
    let tree_id = repo.index()?.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let head = repo.head()?.peel_to_commit()?;

    let message = format!("Revert \"{}\"\n\nThis reverts commit {}.",
        commit.summary().unwrap_or(""),
        commit_hash
    );

    let new_commit_id = repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &message,
        &tree,
        &[&head],
    )?;

    // Cleanup
    repo.cleanup_state()?;

    Ok(new_commit_id.to_string()[..7].to_string())
}

pub fn reset_to_commit(
    repo: &Repository,
    commit_hash: &str,
    mode: &str,
) -> AppResult<()> {
    let oid = Oid::from_str(commit_hash).map_err(|_| AppError::commit_not_found(commit_hash))?;
    let commit = repo.find_commit(oid)?;

    let reset_type = match mode {
        "soft" => git2::ResetType::Soft,
        "mixed" => git2::ResetType::Mixed,
        "hard" => git2::ResetType::Hard,
        _ => git2::ResetType::Mixed,
    };

    repo.reset(commit.as_object(), reset_type, None)?;
    Ok(())
}
