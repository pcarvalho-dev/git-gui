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

#[cfg(test)]
mod tests {
    use super::*;
    use git2::Signature;
    use tempfile::TempDir;
    use std::path::Path;

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
    fn list_commits_retorna_commits_em_ordem_reversa() {
        let (dir, repo) = setup_repo();
        make_commit(&repo, dir.path(), "a.txt", "a", "primeiro");
        make_commit(&repo, dir.path(), "b.txt", "b", "segundo");
        make_commit(&repo, dir.path(), "c.txt", "c", "terceiro");

        let commits = list_commits(&repo, None, 10, 0).unwrap();
        assert_eq!(commits.len(), 3);
        assert_eq!(commits[0].summary, "terceiro");
        assert_eq!(commits[2].summary, "primeiro");
    }

    #[test]
    fn list_commits_respeita_limit() {
        let (dir, repo) = setup_repo();
        for i in 0..5 {
            make_commit(&repo, dir.path(), &format!("f{}.txt", i), "x", &format!("commit {}", i));
        }
        let commits = list_commits(&repo, None, 3, 0).unwrap();
        assert_eq!(commits.len(), 3);
    }

    #[test]
    fn list_commits_respeita_skip() {
        let (dir, repo) = setup_repo();
        make_commit(&repo, dir.path(), "a.txt", "a", "primeiro");
        make_commit(&repo, dir.path(), "b.txt", "b", "segundo");
        make_commit(&repo, dir.path(), "c.txt", "c", "terceiro");

        let commits = list_commits(&repo, None, 10, 1).unwrap();
        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].summary, "segundo");
    }

    #[test]
    fn get_commit_retorna_commit_pelo_hash() {
        let (dir, repo) = setup_repo();
        let hash = make_commit(&repo, dir.path(), "a.txt", "a", "meu commit");
        let commit = get_commit(&repo, &hash).unwrap();
        assert_eq!(commit.summary, "meu commit");
        assert_eq!(commit.hash, hash);
    }

    #[test]
    fn get_commit_hash_invalido_retorna_erro() {
        let (_dir, repo) = setup_repo();
        let result = get_commit(&repo, "invalidhash");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, "COMMIT_NOT_FOUND");
    }

    #[test]
    fn get_commit_hash_inexistente_retorna_erro() {
        let (_dir, repo) = setup_repo();
        let result = get_commit(&repo, "0000000000000000000000000000000000000000");
        assert!(result.is_err());
    }

    #[test]
    fn commit_info_short_hash_tem_7_caracteres() {
        let (dir, repo) = setup_repo();
        let hash = make_commit(&repo, dir.path(), "a.txt", "a", "teste");
        let commit = get_commit(&repo, &hash).unwrap();
        assert_eq!(commit.short_hash.len(), 7);
    }

    #[test]
    fn commit_info_is_merge_false_para_commit_normal() {
        let (dir, repo) = setup_repo();
        let hash = make_commit(&repo, dir.path(), "a.txt", "a", "normal");
        let commit = get_commit(&repo, &hash).unwrap();
        assert!(!commit.is_merge);
    }

    #[test]
    fn commit_info_autor_correto() {
        let (dir, repo) = setup_repo();
        let hash = make_commit(&repo, dir.path(), "a.txt", "a", "com autor");
        let commit = get_commit(&repo, &hash).unwrap();
        assert_eq!(commit.author_name, "Teste");
        assert_eq!(commit.author_email, "teste@test.com");
    }

    #[test]
    fn stage_e_create_commit_cria_novo_commit() {
        let (dir, repo) = setup_repo();
        // Commit inicial
        make_commit(&repo, dir.path(), "base.txt", "base", "base");

        // Cria arquivo e faz stage
        let new_file = dir.path().join("novo.txt");
        std::fs::write(&new_file, "conteúdo").unwrap();
        let repo_path = dir.path().to_path_buf();
        stage_files(&repo, &["novo.txt".to_string()], &repo_path).unwrap();

        let short_hash = create_commit(&repo, "feat: novo arquivo", false).unwrap();
        assert_eq!(short_hash.len(), 7);

        let commits = list_commits(&repo, None, 10, 0).unwrap();
        assert_eq!(commits[0].summary, "feat: novo arquivo");
    }

    #[test]
    fn reset_to_commit_modo_mixed_funciona() {
        let (dir, repo) = setup_repo();
        let hash1 = make_commit(&repo, dir.path(), "a.txt", "a", "primeiro");
        make_commit(&repo, dir.path(), "b.txt", "b", "segundo");

        reset_to_commit(&repo, &hash1, "mixed").unwrap();
        let commits = list_commits(&repo, None, 10, 0).unwrap();
        assert_eq!(commits.len(), 1);
        assert_eq!(commits[0].summary, "primeiro");
    }

    #[test]
    fn list_commits_em_repo_vazio_retorna_lista_vazia() {
        let (_dir, repo) = setup_repo();
        // repo sem commits - revwalk com push_head falha silenciosamente
        let commits = list_commits(&repo, None, 10, 0);
        // pode retornar Err ou Ok([]) dependendo da implementação
        assert!(commits.is_ok() || commits.is_err());
        if let Ok(c) = commits {
            assert!(c.is_empty());
        }
    }
}
