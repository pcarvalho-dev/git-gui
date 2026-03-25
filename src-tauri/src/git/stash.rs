use crate::error::{AppError, AppResult};
use git2::Repository;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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

/// Create stash with specific files using git command
pub fn create_stash_with_files(
    repo_path: &Path,
    message: Option<&str>,
    include_untracked: bool,
    files: &[String],
) -> AppResult<String> {
    let mut args = vec!["stash", "push"];

    if include_untracked {
        args.push("--include-untracked");
    }

    if let Some(msg) = message {
        args.push("-m");
        args.push(msg);
    }

    // Add separator and files
    args.push("--");
    for file in files {
        args.push(file);
    }

    let mut cmd = Command::new("git");
    cmd.args(&args).current_dir(repo_path);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|e| {
        AppError::with_details("STASH_ERROR", "Falha ao executar git stash", &e.to_string())
    })?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(AppError::with_details(
            "STASH_ERROR",
            "Falha ao criar stash",
            stderr.trim(),
        ))
    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use git2::Signature;
    use tempfile::TempDir;

    fn setup_repo_with_commit() -> (TempDir, Repository) {
        let dir = tempfile::tempdir().unwrap();
        let repo = Repository::init(dir.path()).unwrap();

        {
            let mut config = repo.config().unwrap();
            config.set_str("user.name", "Teste").unwrap();
            config.set_str("user.email", "teste@test.com").unwrap();
        }

        // Commit inicial — tree deve ser dropado antes de mover repo
        std::fs::write(dir.path().join("README.md"), "base").unwrap();
        {
            let mut index = repo.index().unwrap();
            index.add_path(std::path::Path::new("README.md")).unwrap();
            index.write().unwrap();
            let tree_id = index.write_tree().unwrap();
            let tree = repo.find_tree(tree_id).unwrap();
            let sig = Signature::now("Teste", "teste@test.com").unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "inicial", &tree, &[])
                .unwrap();
        } // tree dropado aqui

        (dir, repo)
    }

    fn add_modified_file(dir: &TempDir, repo: &Repository) {
        std::fs::write(dir.path().join("README.md"), "modificado").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("README.md")).unwrap();
        index.write().unwrap();
    }

    #[test]
    fn list_stashes_vazio_em_repo_sem_stashes() {
        let (_dir, mut repo) = setup_repo_with_commit();
        let stashes = list_stashes(&mut repo).unwrap();
        assert!(stashes.is_empty());
    }

    #[test]
    fn create_stash_cria_stash_com_mudancas() {
        let (dir, mut repo) = setup_repo_with_commit();
        add_modified_file(&dir, &repo);

        let result = create_stash(&mut repo, Some("meu stash"), false, false);
        assert!(result.is_ok());

        let stashes = list_stashes(&mut repo).unwrap();
        assert_eq!(stashes.len(), 1);
    }

    #[test]
    fn create_stash_retorna_hash_com_7_chars() {
        let (dir, mut repo) = setup_repo_with_commit();
        add_modified_file(&dir, &repo);

        let hash = create_stash(&mut repo, Some("teste"), false, false).unwrap();
        assert_eq!(hash.len(), 7);
    }

    #[test]
    fn list_stashes_retorna_stash_criado() {
        let (dir, mut repo) = setup_repo_with_commit();
        add_modified_file(&dir, &repo);
        create_stash(&mut repo, Some("stash de teste"), false, false).unwrap();

        let stashes = list_stashes(&mut repo).unwrap();
        assert_eq!(stashes.len(), 1);
        assert!(stashes[0].message.contains("stash de teste"));
        assert_eq!(stashes[0].index, 0);
    }

    #[test]
    fn list_stashes_multiplos_em_ordem_lifo() {
        let (dir, mut repo) = setup_repo_with_commit();

        add_modified_file(&dir, &repo);
        create_stash(&mut repo, Some("primeiro"), false, false).unwrap();

        add_modified_file(&dir, &repo);
        create_stash(&mut repo, Some("segundo"), false, false).unwrap();

        let stashes = list_stashes(&mut repo).unwrap();
        assert_eq!(stashes.len(), 2);
        // LIFO: o mais recente fica no índice 0
        assert!(stashes[0].message.contains("segundo"));
        assert!(stashes[1].message.contains("primeiro"));
    }

    #[test]
    fn drop_stash_remove_stash() {
        let (dir, mut repo) = setup_repo_with_commit();
        add_modified_file(&dir, &repo);
        create_stash(&mut repo, Some("para deletar"), false, false).unwrap();

        drop_stash(&mut repo, 0).unwrap();

        let stashes = list_stashes(&mut repo).unwrap();
        assert!(stashes.is_empty());
    }

    #[test]
    fn clear_stashes_remove_todos() {
        let (dir, mut repo) = setup_repo_with_commit();

        add_modified_file(&dir, &repo);
        create_stash(&mut repo, Some("um"), false, false).unwrap();
        add_modified_file(&dir, &repo);
        create_stash(&mut repo, Some("dois"), false, false).unwrap();

        clear_stashes(&mut repo).unwrap();

        let stashes = list_stashes(&mut repo).unwrap();
        assert!(stashes.is_empty());
    }

    #[test]
    fn apply_stash_restaura_mudancas() {
        let (dir, mut repo) = setup_repo_with_commit();
        add_modified_file(&dir, &repo);
        create_stash(&mut repo, Some("aplicar"), false, false).unwrap();

        // Arquivo deve estar limpo após stash
        let content_after_stash = std::fs::read_to_string(dir.path().join("README.md")).unwrap();
        assert_eq!(content_after_stash, "base");

        apply_stash(&mut repo, 0, false).unwrap();

        // Arquivo deve ter voltado à versão modificada
        let content_after_apply = std::fs::read_to_string(dir.path().join("README.md")).unwrap();
        assert_eq!(content_after_apply, "modificado");
    }

    #[test]
    fn apply_stash_com_drop_remove_stash() {
        let (dir, mut repo) = setup_repo_with_commit();
        add_modified_file(&dir, &repo);
        create_stash(&mut repo, Some("pop"), false, false).unwrap();

        apply_stash(&mut repo, 0, true).unwrap(); // pop = apply + drop

        let stashes = list_stashes(&mut repo).unwrap();
        assert!(stashes.is_empty());
    }
}
