use crate::error::AppResult;
use crate::git::submodule;
use crate::git::SubmoduleInfo;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn list_submodules(state: State<'_, AppState>) -> AppResult<Vec<SubmoduleInfo>> {
    let repo = state.open_repo()?;
    submodule::list_submodules(&repo)
}

#[tauri::command]
pub async fn update_submodule(name: String, state: State<'_, AppState>) -> AppResult<()> {
    let path = state.require_repo_path()?;
    submodule::update_submodule(&path.to_string_lossy(), &name)
}

#[tauri::command]
pub async fn add_submodule(
    url: String,
    path: String,
    state: State<'_, AppState>,
) -> AppResult<SubmoduleInfo> {
    let repo_path = state.require_repo_path()?;
    submodule::add_submodule(&repo_path.to_string_lossy(), &url, &path)
}

#[tauri::command]
pub async fn remove_submodule(name: String, state: State<'_, AppState>) -> AppResult<()> {
    let repo_path = state.require_repo_path()?;
    submodule::remove_submodule(&repo_path.to_string_lossy(), &name)
}
