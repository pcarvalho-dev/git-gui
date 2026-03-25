use crate::error::{AppError, AppResult};
use git2::Repository;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoInfo {
    pub path: String,
    pub name: String,
    pub is_repo: bool,
    pub is_bare: bool,
    pub current_branch: Option<String>,
    pub has_remote: bool,
    pub is_empty: bool,
}

#[allow(dead_code)]
pub fn open_repository(path: &Path) -> AppResult<Repository> {
    if !path.exists() {
        return Err(AppError::repo_not_found(&path.to_string_lossy()));
    }
    Repository::open(path).map_err(|_| AppError::invalid_repo(&path.to_string_lossy()))
}

pub fn get_repo_info(path: &Path) -> AppResult<RepoInfo> {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());

    let repo = match Repository::open(path) {
        Ok(r) => r,
        Err(_) => {
            return Ok(RepoInfo {
                path: path.to_string_lossy().to_string(),
                name,
                is_repo: false,
                is_bare: false,
                current_branch: None,
                has_remote: false,
                is_empty: true,
            });
        }
    };

    let current_branch = repo.head().ok().and_then(|h| h.shorthand().map(String::from));

    let has_remote = repo.remotes().map(|r| !r.is_empty()).unwrap_or(false);

    let is_empty = repo.is_empty().unwrap_or(true);

    Ok(RepoInfo {
        path: path.to_string_lossy().to_string(),
        name,
        is_repo: true,
        is_bare: repo.is_bare(),
        current_branch,
        has_remote,
        is_empty,
    })
}

pub fn init_repository(path: &Path, bare: bool) -> AppResult<Repository> {
    if bare {
        Repository::init_bare(path).map_err(AppError::from)
    } else {
        Repository::init(path).map_err(AppError::from)
    }
}

pub fn clone_repository(url: &str, path: &Path) -> AppResult<Repository> {
    Repository::clone(url, path).map_err(AppError::from)
}

pub fn get_git_config(repo: &Repository, key: &str) -> Option<String> {
    repo.config()
        .ok()
        .and_then(|c| c.get_string(key).ok())
}

pub fn set_git_config(repo: &Repository, key: &str, value: &str) -> AppResult<()> {
    let mut config = repo.config().map_err(AppError::from)?;
    config.set_str(key, value).map_err(AppError::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_temp_dir() -> TempDir {
        tempfile::tempdir().expect("falha ao criar diretório temporário")
    }

    #[test]
    fn init_repository_cria_repo_normal() {
        let dir = make_temp_dir();
        let result = init_repository(dir.path(), false);
        assert!(result.is_ok());
        assert!(!result.unwrap().is_bare());
    }

    #[test]
    fn init_repository_cria_repo_bare() {
        let dir = make_temp_dir();
        let result = init_repository(dir.path(), true);
        assert!(result.is_ok());
        assert!(result.unwrap().is_bare());
    }

    #[test]
    fn get_repo_info_em_diretorio_sem_git_retorna_is_repo_false() {
        let dir = make_temp_dir();
        let info = get_repo_info(dir.path()).unwrap();
        assert!(!info.is_repo);
        assert!(info.is_empty);
        assert!(!info.has_remote);
    }

    #[test]
    fn get_repo_info_em_repo_valido_retorna_is_repo_true() {
        let dir = make_temp_dir();
        init_repository(dir.path(), false).unwrap();
        let info = get_repo_info(dir.path()).unwrap();
        assert!(info.is_repo);
        assert!(!info.is_bare);
    }

    #[test]
    fn get_repo_info_retorna_nome_do_diretorio() {
        let dir = make_temp_dir();
        init_repository(dir.path(), false).unwrap();
        let info = get_repo_info(dir.path()).unwrap();
        let expected_name = dir.path().file_name().unwrap().to_string_lossy().to_string();
        assert_eq!(info.name, expected_name);
    }

    #[test]
    fn get_repo_info_repo_vazio_sem_branch_atual() {
        let dir = make_temp_dir();
        init_repository(dir.path(), false).unwrap();
        let info = get_repo_info(dir.path()).unwrap();
        // Repo novo sem commits não tem branch atual definida
        assert!(info.is_empty);
    }

    #[test]
    fn get_repo_info_repo_sem_remote_tem_has_remote_false() {
        let dir = make_temp_dir();
        init_repository(dir.path(), false).unwrap();
        let info = get_repo_info(dir.path()).unwrap();
        assert!(!info.has_remote);
    }

    #[test]
    fn open_repository_falha_em_caminho_inexistente() {
        let result = open_repository(Path::new("/caminho/que/nao/existe/xyz123"));
        assert!(result.is_err());
        // usa .err().unwrap() pois Repository não implementa Debug (necessário para unwrap_err)
        let err = result.err().unwrap();
        assert_eq!(err.code, "REPO_NOT_FOUND");
    }

    #[test]
    fn open_repository_falha_em_diretorio_sem_git() {
        let dir = make_temp_dir();
        let result = open_repository(dir.path());
        assert!(result.is_err());
        let err = result.err().unwrap();
        assert_eq!(err.code, "INVALID_REPO");
    }

    #[test]
    fn open_repository_sucesso_em_repo_valido() {
        let dir = make_temp_dir();
        init_repository(dir.path(), false).unwrap();
        let result = open_repository(dir.path());
        assert!(result.is_ok());
    }

    #[test]
    fn get_e_set_git_config_funcionam() {
        let dir = make_temp_dir();
        let repo = init_repository(dir.path(), false).unwrap();
        set_git_config(&repo, "user.name", "Teste").unwrap();
        let value = get_git_config(&repo, "user.name");
        assert_eq!(value.as_deref(), Some("Teste"));
    }

    #[test]
    fn get_git_config_retorna_none_para_chave_inexistente() {
        let dir = make_temp_dir();
        let repo = init_repository(dir.path(), false).unwrap();
        let value = get_git_config(&repo, "chave.que.nao.existe.xyz");
        assert!(value.is_none());
    }
}
