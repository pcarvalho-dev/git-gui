use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const MAX_RECENT_REPOS: usize = 10;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecentRepo {
    pub path: String,
    pub name: String,
    pub last_opened: i64,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub recent_repos: Vec<RecentRepo>,
    pub theme: String,
    pub default_branch: String,
}

impl AppConfig {
    fn config_dir() -> PathBuf {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("git-gui")
    }

    fn config_path() -> PathBuf {
        Self::config_dir().join("config.json")
    }

    pub fn load() -> Self {
        let path = Self::config_path();
        if let Ok(content) = fs::read_to_string(&path) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Self::default()
        }
    }

    pub fn save(&self) -> AppResult<()> {
        let dir = Self::config_dir();
        fs::create_dir_all(&dir)?;
        let content = serde_json::to_string_pretty(self)?;
        fs::write(Self::config_path(), content)?;
        Ok(())
    }

    pub fn add_recent_repo(&mut self, path: &str) {
        // Remove if exists
        self.recent_repos.retain(|r| r.path != path);

        // Get name from path
        let name = PathBuf::from(path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string());

        // Add to front
        self.recent_repos.insert(
            0,
            RecentRepo {
                path: path.to_string(),
                name,
                last_opened: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0),
            },
        );

        // Limit size
        self.recent_repos.truncate(MAX_RECENT_REPOS);

        // Save
        let _ = self.save();
    }

    pub fn remove_recent_repo(&mut self, path: &str) {
        self.recent_repos.retain(|r| r.path != path);
        let _ = self.save();
    }

    pub fn get_recent_repos(&self) -> Vec<RecentRepo> {
        self.recent_repos.clone()
    }
}
