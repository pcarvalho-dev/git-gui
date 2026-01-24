use crate::error::{AppError, AppResult};
use git2::{FetchOptions, PushOptions, RemoteCallbacks, Repository};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RemoteInfo {
    pub name: String,
    pub fetch_url: String,
    pub push_url: String,
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
    let remote_names: Vec<String> = if let Some(name) = remote_name {
        vec![name.to_string()]
    } else {
        repo.remotes()?
            .iter()
            .filter_map(|n| n.map(String::from))
            .collect()
    };

    let mut callbacks = RemoteCallbacks::new();

    // Setup credentials callback for SSH
    callbacks.credentials(|_url, username_from_url, _allowed_types| {
        git2::Cred::ssh_key_from_agent(username_from_url.unwrap_or("git"))
    });

    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    for name in remote_names {
        let mut remote = repo.find_remote(&name)?;
        remote.fetch(&[] as &[&str], Some(&mut fetch_opts), None)?;
    }

    Ok(())
}

pub fn pull(repo: &Repository, remote_name: &str, branch: &str) -> AppResult<String> {
    // First, fetch
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|_url, username_from_url, _allowed_types| {
        git2::Cred::ssh_key_from_agent(username_from_url.unwrap_or("git"))
    });

    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    let mut remote = repo.find_remote(remote_name)?;
    remote.fetch(&[branch], Some(&mut fetch_opts), None)?;

    // Get fetch head
    let fetch_head = repo.find_reference("FETCH_HEAD")?;
    let fetch_commit = fetch_head.peel_to_commit()?;

    // Get local head
    let head = repo.head()?;
    let head_commit = head.peel_to_commit()?;

    // Check if already up-to-date
    if fetch_commit.id() == head_commit.id() {
        return Ok("already-up-to-date".to_string());
    }

    // Check if fast-forward is possible
    let merge_base = repo.merge_base(head_commit.id(), fetch_commit.id())?;

    if merge_base == head_commit.id() {
        // Fast-forward
        let reflog_msg = format!("pull: Fast-forward");
        repo.reference(
            head.name().unwrap_or("HEAD"),
            fetch_commit.id(),
            true,
            &reflog_msg,
        )?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))?;
        return Ok("fast-forward".to_string());
    }

    // Regular merge
    let signature = repo.signature()?;
    let mut index = repo.merge_commits(&head_commit, &fetch_commit, None)?;

    if index.has_conflicts() {
        return Err(AppError::merge_conflict());
    }

    let tree_id = index.write_tree_to(repo)?;
    let tree = repo.find_tree(tree_id)?;

    let message = format!("Merge remote-tracking branch '{}/{}'", remote_name, branch);

    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &message,
        &tree,
        &[&head_commit, &fetch_commit],
    )?;

    Ok("merge".to_string())
}

pub fn push(repo: &Repository, remote_name: &str, branch: &str, force: bool) -> AppResult<()> {
    let mut callbacks = RemoteCallbacks::new();

    callbacks.credentials(|_url, username_from_url, _allowed_types| {
        git2::Cred::ssh_key_from_agent(username_from_url.unwrap_or("git"))
    });

    // Track push progress
    callbacks.push_update_reference(|refname, status| {
        if let Some(msg) = status {
            eprintln!("Failed to push {}: {}", refname, msg);
        }
        Ok(())
    });

    let mut push_opts = PushOptions::new();
    push_opts.remote_callbacks(callbacks);

    let mut remote = repo.find_remote(remote_name)?;

    let refspec = if force {
        format!("+refs/heads/{}:refs/heads/{}", branch, branch)
    } else {
        format!("refs/heads/{}:refs/heads/{}", branch, branch)
    };

    remote
        .push(&[&refspec], Some(&mut push_opts))
        .map_err(|e| AppError::push_failed(&e.message().to_string()))?;

    Ok(())
}

pub fn set_upstream(repo: &Repository, branch: &str, remote: &str, remote_branch: &str) -> AppResult<()> {
    let mut local_branch = repo.find_branch(branch, git2::BranchType::Local)?;
    let upstream_name = format!("{}/{}", remote, remote_branch);
    local_branch.set_upstream(Some(&upstream_name))?;
    Ok(())
}
