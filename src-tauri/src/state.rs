use crate::error::{AppError, AppResult};
use git2::Repository;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    current_repo_path: Mutex<Option<PathBuf>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            current_repo_path: Mutex::new(None),
        }
    }

    pub fn get_repo_path(&self) -> Option<PathBuf> {
        self.current_repo_path.lock().unwrap().clone()
    }

    pub fn set_repo_path(&self, path: PathBuf) {
        *self.current_repo_path.lock().unwrap() = Some(path);
    }

    pub fn clear_repo(&self) {
        *self.current_repo_path.lock().unwrap() = None;
    }

    pub fn require_repo_path(&self) -> AppResult<PathBuf> {
        self.get_repo_path().ok_or_else(AppError::no_repo)
    }

    pub fn open_repo(&self) -> AppResult<Repository> {
        let path = self.require_repo_path()?;
        Repository::open(&path).map_err(|e| AppError::git_error(e))
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
