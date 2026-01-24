use crate::error::AppResult;
use git2::Repository;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StashInfo {
    pub index: usize,
    pub message: String,
    pub commit_hash: String,
    pub branch: Option<String>,
    pub date: i64,
}

pub fn list_stashes(repo: &mut Repository) -> AppResult<Vec<StashInfo>> {
    // First collect basic stash info
    let mut stash_data: Vec<(usize, String, git2::Oid)> = Vec::new();

    repo.stash_foreach(|index, message, oid| {
        stash_data.push((index, message.to_string(), *oid));
        true
    })?;

    // Then process each stash
    let mut stashes = Vec::new();
    for (index, message, oid) in stash_data {
        let branch = if message.starts_with("On ") {
            message
                .strip_prefix("On ")
                .and_then(|s| s.split(':').next())
                .map(String::from)
        } else {
            None
        };

        let date = repo
            .find_commit(oid)
            .map(|c| c.time().seconds())
            .unwrap_or(0);

        stashes.push(StashInfo {
            index,
            message,
            commit_hash: oid.to_string()[..7].to_string(),
            branch,
            date,
        });
    }

    Ok(stashes)
}

pub fn create_stash(
    repo: &mut Repository,
    message: Option<&str>,
    include_untracked: bool,
    keep_index: bool,
) -> AppResult<String> {
    let signature = repo.signature()?;

    let mut flags = git2::StashFlags::DEFAULT;
    if include_untracked {
        flags |= git2::StashFlags::INCLUDE_UNTRACKED;
    }
    if keep_index {
        flags |= git2::StashFlags::KEEP_INDEX;
    }

    let oid = repo.stash_save2(&signature, message, Some(flags))?;

    Ok(oid.to_string()[..7].to_string())
}

pub fn apply_stash(repo: &mut Repository, index: usize, drop_after: bool) -> AppResult<()> {
    let mut opts = git2::StashApplyOptions::new();

    if drop_after {
        repo.stash_pop(index, Some(&mut opts))?;
    } else {
        repo.stash_apply(index, Some(&mut opts))?;
    }

    Ok(())
}

pub fn drop_stash(repo: &mut Repository, index: usize) -> AppResult<()> {
    repo.stash_drop(index)?;
    Ok(())
}

pub fn clear_stashes(repo: &mut Repository) -> AppResult<()> {
    // Drop stashes from the end to avoid index shifting issues
    let count = {
        let mut count = 0usize;
        repo.stash_foreach(|_, _, _| {
            count += 1;
            true
        })?;
        count
    };

    for _ in 0..count {
        repo.stash_drop(0)?;
    }

    Ok(())
}
