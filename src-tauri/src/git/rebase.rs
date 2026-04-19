use git2::{Oid, Repository};
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::git::commit::{commit_to_info, CommitInfo};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RebaseActionType {
    Pick,
    Reword,
    Squash,
    Fixup,
    Drop,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RebaseEntry {
    pub hash: String,
    pub action: RebaseActionType,
    /// New message for reword; optional override for squash.
    pub message: Option<String>,
}

/// Returns the commits that would be included in an interactive rebase
/// starting from `base_hash` (exclusive) up to HEAD (oldest first).
pub fn get_rebase_range(repo: &Repository, base_hash: &str) -> AppResult<Vec<CommitInfo>> {
    let base_oid = Oid::from_str(base_hash).map_err(|_| AppError::commit_not_found(base_hash))?;

    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::REVERSE)?;
    revwalk.push_head()?;
    revwalk.hide(base_oid)?;

    revwalk
        .map(|r| {
            let oid = r?;
            let commit = repo.find_commit(oid)?;
            Ok(commit_to_info(&commit))
        })
        .collect()
}

/// Executes an interactive rebase in-memory using libgit2's cherrypick_commit.
/// No working-directory changes happen until the final hard-reset at the end.
pub fn perform_interactive_rebase(
    repo: &Repository,
    base_hash: &str,
    entries: &[RebaseEntry],
) -> AppResult<()> {
    if repo.state() != git2::RepositoryState::Clean {
        return Err(AppError::internal(
            "O repositório tem operações pendentes (merge, rebase, cherry-pick, etc.)",
        ));
    }

    let head = repo.head()?;
    let branch_ref = head
        .name()
        .ok_or_else(|| AppError::internal("HEAD está em modo detached"))?
        .to_string();

    let base_oid =
        Oid::from_str(base_hash).map_err(|_| AppError::commit_not_found(base_hash))?;
    let mut current = repo.find_commit(base_oid)?;

    let sig = repo
        .signature()
        .map_err(|_| AppError::git_user_not_configured())?;

    let has_non_drop = entries.iter().any(|e| e.action != RebaseActionType::Drop);
    if !has_non_drop {
        return Err(AppError::internal("Todos os commits foram descartados"));
    }

    for entry in entries {
        if entry.action == RebaseActionType::Drop {
            continue;
        }

        let oid = Oid::from_str(&entry.hash)
            .map_err(|_| AppError::commit_not_found(&entry.hash))?;
        let commit = repo.find_commit(oid)?;

        // Apply the commit's diff onto `current` in-memory.
        let mut index = repo.cherrypick_commit(&commit, &current, 0, None)?;

        if index.has_conflicts() {
            let short = &entry.hash[..7.min(entry.hash.len())];
            let msg = format!(
                "Conflito ao aplicar commit {}. Resolva os conflitos manualmente e tente novamente.",
                short
            );
            return Err(AppError::internal(msg.as_str()));
        }

        let tree_oid = index.write_tree_to(repo)?;
        let tree = repo.find_tree(tree_oid)?;

        let new_oid = match &entry.action {
            RebaseActionType::Pick => {
                let msg = commit.message().unwrap_or("");
                repo.commit(None, &commit.author(), &sig, msg, &tree, &[&current])?
            }

            RebaseActionType::Reword => {
                let msg = entry
                    .message
                    .as_deref()
                    .unwrap_or(commit.message().unwrap_or(""));
                repo.commit(None, &commit.author(), &sig, msg, &tree, &[&current])?
            }

            RebaseActionType::Squash => {
                // Combine current commit's message with this one's; amend current.
                let prev_msg = current.message().unwrap_or("").trim_end();
                let this_msg = entry
                    .message
                    .as_deref()
                    .unwrap_or(commit.message().unwrap_or(""))
                    .trim();
                let combined = format!("{}\n\n{}", prev_msg, this_msg);
                let parents: Vec<git2::Commit> = current.parents().collect();
                let parent_refs: Vec<&git2::Commit> = parents.iter().collect();
                repo.commit(None, &current.author(), &sig, &combined, &tree, &parent_refs)?
            }

            RebaseActionType::Fixup => {
                // Keep current commit's message; amend current.
                let msg = current.message().unwrap_or("").to_string();
                let parents: Vec<git2::Commit> = current.parents().collect();
                let parent_refs: Vec<&git2::Commit> = parents.iter().collect();
                repo.commit(None, &current.author(), &sig, &msg, &tree, &parent_refs)?
            }

            RebaseActionType::Drop => unreachable!(),
        };

        current = repo.find_commit(new_oid)?;
    }

    // Fast-forward the branch ref and reset working tree to the new tip.
    repo.find_reference(&branch_ref)?
        .set_target(current.id(), "rebase interativo")?;

    let obj = repo.find_object(current.id(), None)?;
    repo.reset(&obj, git2::ResetType::Hard, None)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::{Repository, Signature};
    use std::path::Path;
    use tempfile::TempDir;

    fn setup_repo() -> (TempDir, Repository) {
        let dir = tempfile::tempdir().unwrap();
        let repo = Repository::init(dir.path()).unwrap();
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Teste").unwrap();
        config.set_str("user.email", "teste@test.com").unwrap();
        (dir, repo)
    }

    fn make_commit(repo: &Repository, dir: &Path, filename: &str, content: &str, msg: &str) -> String {
        let file_path = dir.join(filename);
        std::fs::write(&file_path, content).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new(filename)).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = Signature::now("Teste", "teste@test.com").unwrap();
        let parents: Vec<git2::Commit> = repo
            .head()
            .ok()
            .and_then(|h| h.peel_to_commit().ok())
            .into_iter()
            .collect();
        let parent_refs: Vec<&git2::Commit> = parents.iter().collect();
        let oid = repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &parent_refs).unwrap();
        oid.to_string()
    }

    #[test]
    fn get_rebase_range_retorna_commits_apos_base() {
        let (dir, repo) = setup_repo();
        let hash_a = make_commit(&repo, dir.path(), "a.txt", "a", "commit A");
        let _hash_b = make_commit(&repo, dir.path(), "b.txt", "b", "commit B");
        let _hash_c = make_commit(&repo, dir.path(), "c.txt", "c", "commit C");

        let range = get_rebase_range(&repo, &hash_a).unwrap();
        assert_eq!(range.len(), 2);
        assert_eq!(range[0].summary, "commit B");
        assert_eq!(range[1].summary, "commit C");
    }

    #[test]
    fn rebase_pick_preserva_commits_em_nova_ordem() {
        let (dir, repo) = setup_repo();
        let hash_base = make_commit(&repo, dir.path(), "base.txt", "base", "base");
        let hash_b = make_commit(&repo, dir.path(), "b.txt", "b", "commit B");
        let hash_c = make_commit(&repo, dir.path(), "c.txt", "c", "commit C");

        let entries = vec![
            RebaseEntry { hash: hash_c.clone(), action: RebaseActionType::Pick, message: None },
            RebaseEntry { hash: hash_b.clone(), action: RebaseActionType::Pick, message: None },
        ];

        perform_interactive_rebase(&repo, &hash_base, &entries).unwrap();

        let commits = crate::git::list_commits(&repo, None, 10, 0).unwrap();
        assert_eq!(commits[0].summary, "commit B");
        assert_eq!(commits[1].summary, "commit C");
        assert_eq!(commits[2].summary, "base");
    }

    #[test]
    fn rebase_drop_remove_commit() {
        let (dir, repo) = setup_repo();
        let hash_base = make_commit(&repo, dir.path(), "base.txt", "base", "base");
        let hash_b = make_commit(&repo, dir.path(), "b.txt", "b", "commit B");
        let hash_c = make_commit(&repo, dir.path(), "c.txt", "c", "commit C");

        let entries = vec![
            RebaseEntry { hash: hash_b.clone(), action: RebaseActionType::Drop, message: None },
            RebaseEntry { hash: hash_c.clone(), action: RebaseActionType::Pick, message: None },
        ];

        perform_interactive_rebase(&repo, &hash_base, &entries).unwrap();

        let commits = crate::git::list_commits(&repo, None, 10, 0).unwrap();
        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].summary, "commit C");
        assert_eq!(commits[1].summary, "base");
    }

    #[test]
    fn rebase_reword_muda_mensagem() {
        let (dir, repo) = setup_repo();
        let hash_base = make_commit(&repo, dir.path(), "base.txt", "base", "base");
        let hash_b = make_commit(&repo, dir.path(), "b.txt", "b", "commit B");

        let entries = vec![
            RebaseEntry {
                hash: hash_b.clone(),
                action: RebaseActionType::Reword,
                message: Some("commit B renomeado".to_string()),
            },
        ];

        perform_interactive_rebase(&repo, &hash_base, &entries).unwrap();

        let commits = crate::git::list_commits(&repo, None, 10, 0).unwrap();
        assert_eq!(commits[0].summary, "commit B renomeado");
    }

    #[test]
    fn rebase_fixup_combina_commits_com_mensagem_anterior() {
        let (dir, repo) = setup_repo();
        let hash_base = make_commit(&repo, dir.path(), "base.txt", "base", "base");
        let hash_b = make_commit(&repo, dir.path(), "b.txt", "b", "commit B");
        let hash_c = make_commit(&repo, dir.path(), "c.txt", "c", "commit C (fixup)");

        let entries = vec![
            RebaseEntry { hash: hash_b.clone(), action: RebaseActionType::Pick, message: None },
            RebaseEntry { hash: hash_c.clone(), action: RebaseActionType::Fixup, message: None },
        ];

        perform_interactive_rebase(&repo, &hash_base, &entries).unwrap();

        let commits = crate::git::list_commits(&repo, None, 10, 0).unwrap();
        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].summary, "commit B");
    }

    #[test]
    fn rebase_squash_combina_mensagens() {
        let (dir, repo) = setup_repo();
        let hash_base = make_commit(&repo, dir.path(), "base.txt", "base", "base");
        let hash_b = make_commit(&repo, dir.path(), "b.txt", "b", "commit B");
        let hash_c = make_commit(&repo, dir.path(), "c.txt", "c", "commit C");

        let entries = vec![
            RebaseEntry { hash: hash_b.clone(), action: RebaseActionType::Pick, message: None },
            RebaseEntry { hash: hash_c.clone(), action: RebaseActionType::Squash, message: None },
        ];

        perform_interactive_rebase(&repo, &hash_base, &entries).unwrap();

        let commits = crate::git::list_commits(&repo, None, 10, 0).unwrap();
        assert_eq!(commits.len(), 2);
        assert!(commits[0].message.contains("commit B"));
        assert!(commits[0].message.contains("commit C"));
    }

    #[test]
    fn rebase_todos_drop_retorna_erro() {
        let (dir, repo) = setup_repo();
        let hash_base = make_commit(&repo, dir.path(), "base.txt", "base", "base");
        let hash_b = make_commit(&repo, dir.path(), "b.txt", "b", "commit B");

        let entries = vec![
            RebaseEntry { hash: hash_b.clone(), action: RebaseActionType::Drop, message: None },
        ];

        let result = perform_interactive_rebase(&repo, &hash_base, &entries);
        assert!(result.is_err());
    }
}
