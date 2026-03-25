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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_cria_erro_sem_details() {
        let err = AppError::new("MY_CODE", "minha mensagem");
        assert_eq!(err.code, "MY_CODE");
        assert_eq!(err.message, "minha mensagem");
        assert!(err.details.is_none());
    }

    #[test]
    fn with_details_cria_erro_com_details() {
        let err = AppError::with_details("ERR", "mensagem", "detalhe extra");
        assert_eq!(err.code, "ERR");
        assert_eq!(err.message, "mensagem");
        assert_eq!(err.details.as_deref(), Some("detalhe extra"));
    }

    #[test]
    fn no_repo_tem_codigo_correto() {
        let err = AppError::no_repo();
        assert_eq!(err.code, "NO_REPO");
        assert!(err.details.is_none());
    }

    #[test]
    fn invalid_repo_inclui_path_nos_details() {
        let err = AppError::invalid_repo("/caminho/invalido");
        assert_eq!(err.code, "INVALID_REPO");
        assert_eq!(err.details.as_deref(), Some("/caminho/invalido"));
    }

    #[test]
    fn repo_not_found_inclui_path_nos_details() {
        let err = AppError::repo_not_found("/nao/existe");
        assert_eq!(err.code, "REPO_NOT_FOUND");
        assert_eq!(err.details.as_deref(), Some("/nao/existe"));
    }

    #[test]
    fn branch_not_found_inclui_nome() {
        let err = AppError::branch_not_found("feature-x");
        assert_eq!(err.code, "BRANCH_NOT_FOUND");
        assert_eq!(err.details.as_deref(), Some("feature-x"));
    }

    #[test]
    fn branch_already_exists_inclui_nome() {
        let err = AppError::branch_already_exists("main");
        assert_eq!(err.code, "BRANCH_EXISTS");
        assert_eq!(err.details.as_deref(), Some("main"));
    }

    #[test]
    fn cannot_delete_current_sem_details() {
        let err = AppError::cannot_delete_current_branch();
        assert_eq!(err.code, "CANNOT_DELETE_CURRENT");
        assert!(err.details.is_none());
    }

    #[test]
    fn commit_not_found_inclui_hash() {
        let err = AppError::commit_not_found("abc1234");
        assert_eq!(err.code, "COMMIT_NOT_FOUND");
        assert_eq!(err.details.as_deref(), Some("abc1234"));
    }

    #[test]
    fn nothing_to_commit_sem_details() {
        let err = AppError::nothing_to_commit();
        assert_eq!(err.code, "NOTHING_TO_COMMIT");
        assert!(err.details.is_none());
    }

    #[test]
    fn merge_conflict_sem_details() {
        let err = AppError::merge_conflict();
        assert_eq!(err.code, "MERGE_CONFLICT");
        assert!(err.details.is_none());
    }

    #[test]
    fn stash_not_found_inclui_indice() {
        let err = AppError::stash_not_found(3);
        assert_eq!(err.code, "STASH_NOT_FOUND");
        assert_eq!(err.details.as_deref(), Some("3"));
    }

    #[test]
    fn push_failed_inclui_detalhes() {
        let err = AppError::push_failed("autenticação falhou");
        assert_eq!(err.code, "PUSH_FAILED");
        assert_eq!(err.details.as_deref(), Some("autenticação falhou"));
    }

    #[test]
    fn display_com_details_formata_corretamente() {
        let err = AppError::with_details("ERR", "mensagem", "detalhe");
        assert_eq!(format!("{}", err), "mensagem: detalhe");
    }

    #[test]
    fn display_sem_details_mostra_apenas_mensagem() {
        let err = AppError::new("ERR", "só a mensagem");
        assert_eq!(format!("{}", err), "só a mensagem");
    }

    #[test]
    fn from_io_error_gera_io_error_code() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "arquivo não encontrado");
        let err = AppError::from(io_err);
        assert_eq!(err.code, "IO_ERROR");
        assert!(err.details.is_some());
    }

    #[test]
    fn internal_error_tem_codigo_internal_error() {
        let err = AppError::internal("algo quebrou internamente");
        assert_eq!(err.code, "INTERNAL_ERROR");
        assert_eq!(err.message, "algo quebrou internamente");
    }
}
