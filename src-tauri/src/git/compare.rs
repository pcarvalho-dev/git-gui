use crate::error::{AppError, AppResult};
use git2::{Oid, Repository};
use serde::{Deserialize, Serialize};

use super::{commit_to_info, parse_diff, CommitInfo, DiffInfo};

const MAX_COMPARE_COMMITS: usize = 200;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompareResult {
    pub base_ref: String,
    pub head_ref: String,
    pub base_hash: String,
    pub head_hash: String,
    pub merge_base_hash: Option<String>,
    pub diff_base_hash: String,
    pub uses_merge_base: bool,
    pub ahead: usize,
    pub behind: usize,
    pub base_only_commits: Vec<CommitInfo>,
    pub head_only_commits: Vec<CommitInfo>,
    pub diff: Vec<DiffInfo>,
}

pub fn compare_refs(repo: &Repository, base_ref: &str, head_ref: &str) -> AppResult<CompareResult> {
    let base_commit = resolve_ref_to_commit(repo, base_ref)?;
    let head_commit = resolve_ref_to_commit(repo, head_ref)?;
    let base_oid = base_commit.id();
    let head_oid = head_commit.id();

    let (ahead, behind) = repo.graph_ahead_behind(head_oid, base_oid)?;
    let merge_base_oid = repo.merge_base(base_oid, head_oid).ok();
    let diff_base_oid = merge_base_oid.unwrap_or(base_oid);
    let diff_base_commit = repo.find_commit(diff_base_oid)?;
    let diff = diff_between_commits(repo, diff_base_oid, head_oid)?;

    Ok(CompareResult {
        base_ref: base_ref.to_string(),
        head_ref: head_ref.to_string(),
        base_hash: base_oid.to_string(),
        head_hash: head_oid.to_string(),
        merge_base_hash: merge_base_oid.map(|oid| oid.to_string()),
        diff_base_hash: diff_base_commit.id().to_string(),
        uses_merge_base: merge_base_oid.is_some(),
        ahead,
        behind,
        base_only_commits: list_exclusive_commits(repo, base_oid, head_oid, MAX_COMPARE_COMMITS)?,
        head_only_commits: list_exclusive_commits(repo, head_oid, base_oid, MAX_COMPARE_COMMITS)?,
        diff,
    })
}

fn resolve_ref_to_commit<'repo>(
    repo: &'repo Repository,
    reference: &str,
) -> AppResult<git2::Commit<'repo>> {
    let resolved = repo
        .revparse_single(reference)
        .or_else(|_| repo.revparse_single(&format!("refs/heads/{reference}")))
        .or_else(|_| repo.revparse_single(&format!("refs/remotes/{reference}")))
        .or_else(|_| repo.revparse_single(&format!("refs/tags/{reference}")))
        .map_err(|_| AppError::with_details("REF_NOT_FOUND", "Referencia nao encontrada", reference))?;

    resolved
        .peel_to_commit()
        .map_err(|_| AppError::with_details("REF_NOT_COMMIT", "Referencia nao aponta para um commit", reference))
}

fn list_exclusive_commits(
    repo: &Repository,
    include_oid: Oid,
    exclude_oid: Oid,
    limit: usize,
) -> AppResult<Vec<CommitInfo>> {
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(git2::Sort::TIME | git2::Sort::TOPOLOGICAL)?;
    revwalk.push(include_oid)?;
    revwalk.hide(exclude_oid)?;

    let mut commits = Vec::new();
    for oid in revwalk {
        if commits.len() >= limit {
            break;
        }

        let commit = repo.find_commit(oid?)?;
        commits.push(commit_to_info(&commit));
    }

    Ok(commits)
}

fn diff_between_commits(repo: &Repository, base_oid: Oid, head_oid: Oid) -> AppResult<Vec<DiffInfo>> {
    let base_commit = repo.find_commit(base_oid)?;
    let head_commit = repo.find_commit(head_oid)?;
    let base_tree = base_commit.tree()?;
    let head_tree = head_commit.tree()?;
    let diff = repo.diff_tree_to_tree(Some(&base_tree), Some(&head_tree), None)?;
    parse_diff(&diff, repo)
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::{BranchType, Repository, Signature};
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

    fn commit_file(repo: &Repository, dir: &TempDir, file: &str, content: &str, message: &str) -> String {
        std::fs::write(dir.path().join(file), content).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new(file)).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = Signature::now("Teste", "teste@test.com").unwrap();
        let parents: Vec<git2::Commit> = repo
            .head()
            .ok()
            .and_then(|head| head.peel_to_commit().ok())
            .into_iter()
            .collect();
        let parent_refs: Vec<&git2::Commit> = parents.iter().collect();
        let oid = repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parent_refs).unwrap();
        oid.to_string()
    }

    #[test]
    fn compare_refs_retorna_ahead_behind_e_commits_exclusivos() {
        let (dir, repo) = setup_repo();
        commit_file(&repo, &dir, "README.md", "base\n", "base");
        let default_branch = repo.head().unwrap().shorthand().unwrap().to_string();
        repo.branch("feature", &repo.head().unwrap().peel_to_commit().unwrap(), false)
            .unwrap();

        commit_file(&repo, &dir, "main.txt", "main\n", "main only");

        let feature_ref = repo.find_branch("feature", BranchType::Local).unwrap().into_reference();
        let feature_commit = feature_ref.peel_to_commit().unwrap();
        repo.checkout_tree(feature_commit.as_object(), None).unwrap();
        repo.set_head("refs/heads/feature").unwrap();
        commit_file(&repo, &dir, "feature.txt", "feature\n", "feature only");

        let result = compare_refs(&repo, &default_branch, "feature").unwrap();

        assert_eq!(result.ahead, 1);
        assert_eq!(result.behind, 1);
        assert_eq!(result.head_only_commits.len(), 1);
        assert_eq!(result.base_only_commits.len(), 1);
        assert_eq!(result.head_only_commits[0].summary, "feature only");
        assert_eq!(result.base_only_commits[0].summary, "main only");
        assert!(result.diff.iter().any(|entry| entry.path == "feature.txt"));
    }

    #[test]
    fn compare_refs_com_mesma_ref_nao_retorna_diferencas() {
        let (dir, repo) = setup_repo();
        commit_file(&repo, &dir, "README.md", "base\n", "base");

        let result = compare_refs(&repo, "HEAD", "HEAD").unwrap();

        assert_eq!(result.ahead, 0);
        assert_eq!(result.behind, 0);
        assert!(result.base_only_commits.is_empty());
        assert!(result.head_only_commits.is_empty());
        assert!(result.diff.is_empty());
    }
}
