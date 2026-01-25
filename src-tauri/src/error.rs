use serde::Serialize;
use std::fmt;

#[derive(Debug, Serialize, Clone)]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
}

#[allow(dead_code)]
impl AppError {
    pub fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            details: None,
        }
    }

    pub fn with_details(code: &str, message: &str, details: &str) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            details: Some(details.to_string()),
        }
    }

    // Repository errors
    pub fn no_repo() -> Self {
        Self::new("NO_REPO", "Nenhum repositório aberto")
    }

    pub fn invalid_repo(path: &str) -> Self {
        Self::with_details("INVALID_REPO", "Diretório não é um repositório Git", path)
    }

    pub fn repo_not_found(path: &str) -> Self {
        Self::with_details("REPO_NOT_FOUND", "Caminho não encontrado", path)
    }

    // Git config errors
    pub fn git_user_not_configured() -> Self {
        Self::with_details(
            "GIT_USER_NOT_CONFIGURED",
            "Usuário Git não configurado",
            "Configure com: git config --global user.name \"Seu Nome\" && git config --global user.email \"seu@email.com\""
        )
    }

    // Branch errors
    pub fn branch_not_found(name: &str) -> Self {
        Self::with_details("BRANCH_NOT_FOUND", "Branch não encontrada", name)
    }

    pub fn branch_already_exists(name: &str) -> Self {
        Self::with_details("BRANCH_EXISTS", "Branch já existe", name)
    }

    pub fn cannot_delete_current_branch() -> Self {
        Self::new("CANNOT_DELETE_CURRENT", "Não é possível deletar a branch atual")
    }

    // Commit errors
    pub fn nothing_to_commit() -> Self {
        Self::new("NOTHING_TO_COMMIT", "Nenhuma alteração para commit")
    }

    pub fn commit_not_found(hash: &str) -> Self {
        Self::with_details("COMMIT_NOT_FOUND", "Commit não encontrado", hash)
    }

    // Merge errors
    pub fn merge_conflict() -> Self {
        Self::new("MERGE_CONFLICT", "Conflitos de merge detectados")
    }

    // Remote errors
    pub fn remote_not_found(name: &str) -> Self {
        Self::with_details("REMOTE_NOT_FOUND", "Remote não encontrado", name)
    }

    pub fn push_failed(details: &str) -> Self {
        Self::with_details("PUSH_FAILED", "Falha ao fazer push", details)
    }

    pub fn pull_failed(details: &str) -> Self {
        Self::with_details("PULL_FAILED", "Falha ao fazer pull", details)
    }

    // Stash errors
    pub fn stash_not_found(index: usize) -> Self {
        Self::with_details("STASH_NOT_FOUND", "Stash não encontrado", &index.to_string())
    }

    // Generic errors
    pub fn git_error(e: git2::Error) -> Self {
        Self::with_details("GIT_ERROR", "Erro do Git", &e.message().to_string())
    }

    pub fn io_error(e: std::io::Error) -> Self {
        Self::with_details("IO_ERROR", "Erro de I/O", &e.to_string())
    }

    pub fn internal(message: &str) -> Self {
        Self::new("INTERNAL_ERROR", message)
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if let Some(details) = &self.details {
            write!(f, "{}: {}", self.message, details)
        } else {
            write!(f, "{}", self.message)
        }
    }
}

impl std::error::Error for AppError {}

impl From<git2::Error> for AppError {
    fn from(e: git2::Error) -> Self {
        Self::git_error(e)
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        Self::io_error(e)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        Self::with_details("JSON_ERROR", "Erro ao processar JSON", &e.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
