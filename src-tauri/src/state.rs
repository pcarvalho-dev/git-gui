use crate::error::{AppError, AppResult};
use git2::Repository;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    /// Map of repo ID to repo path
    repos: Mutex<HashMap<String, PathBuf>>,
    /// Currently active repo ID
    active_repo: Mutex<Option<String>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            repos: Mutex::new(HashMap::new()),
            active_repo: Mutex::new(None),
        }
    }

    /// Generate a unique ID for a repo based on its path
    fn path_to_id(path: &PathBuf) -> String {
        // Use the path string as ID (normalized)
        path.to_string_lossy().to_string()
    }

    /// Get the currently active repo path
    pub fn get_repo_path(&self) -> Option<PathBuf> {
        let active = self.active_repo.lock().unwrap();
        let repos = self.repos.lock().unwrap();
        active.as_ref().and_then(|id| repos.get(id).cloned())
    }

    /// Add a repo and set it as active
    pub fn set_repo_path(&self, path: PathBuf) {
        let id = Self::path_to_id(&path);
        {
            let mut repos = self.repos.lock().unwrap();
            repos.insert(id.clone(), path);
        }
        {
            let mut active = self.active_repo.lock().unwrap();
            *active = Some(id);
        }
    }

    /// Set active repo by ID
    pub fn set_active_repo(&self, id: &str) -> bool {
        let repos = self.repos.lock().unwrap();
        if repos.contains_key(id) {
            let mut active = self.active_repo.lock().unwrap();
            *active = Some(id.to_string());
            true
        } else {
            false
        }
    }

    /// Close a specific repo by ID
    pub fn close_repo_by_id(&self, id: &str) {
        {
            let mut repos = self.repos.lock().unwrap();
            repos.remove(id);
        }
        {
            let mut active = self.active_repo.lock().unwrap();
            if active.as_ref().map(|a| a == id).unwrap_or(false) {
                // Set active to another open repo or None
                let repos = self.repos.lock().unwrap();
                *active = repos.keys().next().cloned();
            }
        }
    }

    /// Close the currently active repo
    pub fn clear_repo(&self) {
        let active_id = {
            let active = self.active_repo.lock().unwrap();
            active.clone()
        };
        if let Some(id) = active_id {
            self.close_repo_by_id(&id);
        }
    }

    /// Get all open repos
    pub fn get_open_repos(&self) -> Vec<(String, PathBuf)> {
        let repos = self.repos.lock().unwrap();
        repos.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
    }

    /// Get the active repo ID
    pub fn get_active_repo_id(&self) -> Option<String> {
        self.active_repo.lock().unwrap().clone()
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
