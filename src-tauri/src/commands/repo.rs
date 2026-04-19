use crate::config::{AppConfig, RecentRepo};
use crate::error::AppResult;
use crate::git;
use crate::state::AppState;
use std::path::{Component, Path, PathBuf};
use tauri::State;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn resolve_repo_file_path(repo_path: &Path, relative_path: &str) -> AppResult<PathBuf> {
    if relative_path.trim().is_empty() {
        return Err(crate::error::AppError::with_details(
            "INVALID_FILE_PATH",
            "Caminho de arquivo invalido",
            "O caminho nao pode ser vazio",
        ));
    }

    let repo_root = std::fs::canonicalize(repo_path).map_err(|e| {
        crate::error::AppError::with_details(
            "INVALID_REPO_ROOT",
            "Nao foi possivel resolver o diretorio do repositorio",
            &e.to_string(),
        )
    })?;

    let mut resolved = repo_root.clone();
    for component in Path::new(relative_path).components() {
        match component {
            Component::Normal(part) => resolved.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(crate::error::AppError::with_details(
                    "INVALID_FILE_PATH",
                    "Caminho de arquivo invalido",
                    relative_path,
                ));
            }
        }
    }

    Ok(resolved)
}

#[tauri::command]
pub async fn open_repo(
    path: String,
    state: State<'_, AppState>,
) -> AppResult<git::RepoInfo> {
    let repo_path = PathBuf::from(&path);
    let info = git::get_repo_info(&repo_path)?;

    if info.is_repo {
        state.set_repo_path(repo_path);

        // Add to recent repos
        let mut config = AppConfig::load();
        config.add_recent_repo(&path);
    }

    Ok(info)
}

#[tauri::command]
pub async fn close_repo(state: State<'_, AppState>) -> AppResult<()> {
    state.clear_repo();
    Ok(())
}

#[tauri::command]
pub async fn close_repo_by_id(id: String, state: State<'_, AppState>) -> AppResult<()> {
    state.close_repo_by_id(&id);
    Ok(())
}

#[tauri::command]
pub async fn get_open_repos(state: State<'_, AppState>) -> AppResult<Vec<OpenRepoInfo>> {
    let repos = state.get_open_repos();
    let active_id = state.get_active_repo_id();

    let mut result = Vec::new();
    for (id, path) in repos {
        let info = git::get_repo_info(&path)?;
        result.push(OpenRepoInfo {
            id: id.clone(),
            path: path.to_string_lossy().to_string(),
            name: info.name,
            is_active: active_id.as_ref() == Some(&id),
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn set_active_repo(id: String, state: State<'_, AppState>) -> AppResult<bool> {
    Ok(state.set_active_repo(&id))
}

#[derive(serde::Serialize)]
pub struct OpenRepoInfo {
    pub id: String,
    pub path: String,
    pub name: String,
    pub is_active: bool,
}

#[tauri::command]
pub async fn get_repo_info(state: State<'_, AppState>) -> AppResult<git::RepoInfo> {
    let path = state.require_repo_path()?;
    git::get_repo_info(&path)
}

#[tauri::command]
pub async fn get_repo_status(state: State<'_, AppState>) -> AppResult<git::RepoStatus> {
    let repo = state.open_repo()?;
    git::get_status(&repo)
}

#[tauri::command]
pub async fn init_repo(path: String, bare: bool) -> AppResult<git::RepoInfo> {
    let repo_path = PathBuf::from(&path);
    git::init_repository(&repo_path, bare)?;
    git::get_repo_info(&repo_path)
}

#[tauri::command]
pub async fn clone_repo(
    url: String,
    path: String,
    state: State<'_, AppState>,
) -> AppResult<git::RepoInfo> {
    let repo_path = PathBuf::from(&path);
    git::clone_repository(&url, &repo_path)?;

    let info = git::get_repo_info(&repo_path)?;

    if info.is_repo {
        state.set_repo_path(repo_path);

        let mut config = AppConfig::load();
        config.add_recent_repo(&path);
    }

    Ok(info)
}

#[tauri::command]
pub async fn get_recent_repos() -> AppResult<Vec<RecentRepo>> {
    let config = AppConfig::load();
    Ok(config.get_recent_repos())
}

#[tauri::command]
pub async fn remove_recent_repo(path: String) -> AppResult<()> {
    let mut config = AppConfig::load();
    config.remove_recent_repo(&path);
    Ok(())
}

#[tauri::command]
pub async fn clear_recent_repos() -> AppResult<()> {
    let mut config = AppConfig::load();
    config.recent_repos.clear();
    config.save()?;
    Ok(())
}

#[tauri::command]
pub async fn get_git_config_value(
    key: String,
    state: State<'_, AppState>,
) -> AppResult<Option<String>> {
    let repo = state.open_repo()?;
    Ok(git::get_git_config(&repo, &key))
}

#[tauri::command]
pub async fn set_git_config_value(
    key: String,
    value: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let repo = state.open_repo()?;
    git::set_git_config(&repo, &key, &value)
}

#[tauri::command]
pub async fn read_file(state: State<'_, AppState>, path: String) -> AppResult<String> {
    let repo_path = state.require_repo_path()?;
    let full_path = resolve_repo_file_path(&repo_path, &path)?;

    std::fs::read_to_string(&full_path).map_err(|e| {
        crate::error::AppError::with_details("READ_ERROR", "Erro ao ler arquivo", &e.to_string())
    })
}

#[tauri::command]
pub async fn write_file(state: State<'_, AppState>, path: String, content: String) -> AppResult<()> {
    let repo_path = state.require_repo_path()?;
    let full_path = resolve_repo_file_path(&repo_path, &path)?;

    std::fs::write(&full_path, content).map_err(|e| {
        crate::error::AppError::with_details("WRITE_ERROR", "Erro ao salvar arquivo", &e.to_string())
    })
}

#[tauri::command]
pub async fn open_in_vscode(state: State<'_, AppState>) -> AppResult<()> {
    let path = state.require_repo_path()?;
    let path_str = path.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", "code", &path_str]);
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.spawn()
            .map_err(|e| crate::error::AppError::with_details("VSCODE_ERROR", "Falha ao abrir VS Code", &e.to_string()))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-a", "Visual Studio Code", &path_str])
            .spawn()
            .map_err(|e| crate::error::AppError::with_details("VSCODE_ERROR", "Falha ao abrir VS Code", &e.to_string()))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("code")
            .arg(&path_str)
            .spawn()
            .map_err(|e| crate::error::AppError::with_details("VSCODE_ERROR", "Falha ao abrir VS Code", &e.to_string()))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn open_in_explorer(state: State<'_, AppState>) -> AppResult<()> {
    let path = state.require_repo_path()?;
    let path_str = path.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        let mut cmd = std::process::Command::new("explorer");
        cmd.arg(&path_str);
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.spawn()
            .map_err(|e| crate::error::AppError::with_details("EXPLORER_ERROR", "Falha ao abrir Explorer", &e.to_string()))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| crate::error::AppError::with_details("EXPLORER_ERROR", "Falha ao abrir Finder", &e.to_string()))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| crate::error::AppError::with_details("EXPLORER_ERROR", "Falha ao abrir gerenciador de arquivos", &e.to_string()))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn open_in_terminal(emulator: String, state: State<'_, AppState>) -> AppResult<()> {
    let path = state.require_repo_path()?;
    let path_str = path.to_string_lossy().to_string();

    #[cfg(target_os = "linux")]
    {
        let mut cmd = match emulator.as_str() {
            "gnome-terminal" => {
                let mut c = std::process::Command::new("gnome-terminal");
                c.arg(format!("--working-directory={}", path_str));
                c
            }
            "konsole" => {
                let mut c = std::process::Command::new("konsole");
                c.args(["--workdir", &path_str]);
                c
            }
            "xfce4-terminal" => {
                let mut c = std::process::Command::new("xfce4-terminal");
                c.args(["--working-directory", &path_str]);
                c
            }
            "tilix" => {
                let mut c = std::process::Command::new("tilix");
                c.args(["--working-directory", &path_str]);
                c
            }
            "alacritty" => {
                let mut c = std::process::Command::new("alacritty");
                c.args(["--working-directory", &path_str]);
                c
            }
            "kitty" => {
                let mut c = std::process::Command::new("kitty");
                c.args(["--directory", &path_str]);
                c
            }
            "xterm" => {
                let mut c = std::process::Command::new("xterm");
                c.args(["-e", "bash", "-c", &format!("cd '{}'; exec bash", path_str)]);
                c
            }
            _ => {
                let mut c = std::process::Command::new(&emulator);
                c.args(["--working-directory", &path_str]);
                c
            }
        };
        cmd.spawn()
            .map_err(|e| crate::error::AppError::with_details("TERMINAL_ERROR", "Falha ao abrir terminal", &e.to_string()))?;
    }

    #[cfg(target_os = "macos")]
    {
        let mut cmd = match emulator.as_str() {
            "terminal" => {
                let mut c = std::process::Command::new("open");
                c.args(["-a", "Terminal", &path_str]);
                c
            }
            "iterm" => {
                let mut c = std::process::Command::new("open");
                c.args(["-a", "iTerm", &path_str]);
                c
            }
            "alacritty" => {
                let mut c = std::process::Command::new("alacritty");
                c.args(["--working-directory", &path_str]);
                c
            }
            "kitty" => {
                let mut c = std::process::Command::new("kitty");
                c.args(["--directory", &path_str]);
                c
            }
            _ => {
                let mut c = std::process::Command::new("open");
                c.args(["-a", &emulator, &path_str]);
                c
            }
        };
        cmd.spawn()
            .map_err(|e| crate::error::AppError::with_details("TERMINAL_ERROR", "Falha ao abrir terminal", &e.to_string()))?;
    }

    #[cfg(target_os = "windows")]
    {
        let mut cmd = match emulator.as_str() {
            "wt" => {
                let mut c = std::process::Command::new("wt");
                c.args(["-d", &path_str]);
                c
            }
            "powershell" => {
                let mut c = std::process::Command::new("powershell");
                c.args(["-NoExit", "-Command", &format!("cd '{}'", path_str)]);
                c
            }
            _ => {
                let mut c = std::process::Command::new("cmd");
                c.args(["/K", &format!("cd /d {}", path_str)]);
                c
            }
        };
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.spawn()
            .map_err(|e| crate::error::AppError::with_details("TERMINAL_ERROR", "Falha ao abrir terminal", &e.to_string()))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::resolve_repo_file_path;

    #[test]
    fn resolve_repo_file_path_aceita_caminho_relativo_valido() {
        let dir = tempfile::tempdir().unwrap();
        let resolved = resolve_repo_file_path(dir.path(), "src/main.rs").unwrap();
        assert!(resolved.ends_with(std::path::Path::new("src").join("main.rs")));
    }

    #[test]
    fn resolve_repo_file_path_rejeita_parent_dir() {
        let dir = tempfile::tempdir().unwrap();
        let err = resolve_repo_file_path(dir.path(), "../fora.txt").unwrap_err();
        assert_eq!(err.code, "INVALID_FILE_PATH");
    }

    #[test]
    fn resolve_repo_file_path_rejeita_caminho_absoluto() {
        let dir = tempfile::tempdir().unwrap();
        let absolute = if cfg!(windows) { r"C:\fora.txt" } else { "/fora.txt" };
        let err = resolve_repo_file_path(dir.path(), absolute).unwrap_err();
        assert_eq!(err.code, "INVALID_FILE_PATH");
    }
}
