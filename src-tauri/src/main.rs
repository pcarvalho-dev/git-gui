#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod config;
mod error;
mod git;
mod state;
mod terminal;

use state::AppState;
use terminal::create_terminal_state;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .manage(create_terminal_state())
        .invoke_handler(tauri::generate_handler![
            // Repository
            commands::open_repo,
            commands::close_repo,
            commands::get_repo_info,
            commands::get_repo_status,
            commands::init_repo,
            commands::clone_repo,
            commands::get_recent_repos,
            commands::remove_recent_repo,
            commands::clear_recent_repos,
            commands::get_git_config_value,
            commands::set_git_config_value,
            commands::read_file,
            commands::write_file,
            commands::open_in_vscode,
            // Branches
            commands::get_branches,
            commands::get_current_branch,
            commands::create_branch,
            commands::checkout_branch,
            commands::delete_branch,
            commands::rename_branch,
            commands::merge_branch,
            // Commits
            commands::get_commits,
            commands::get_commit,
            commands::create_commit,
            commands::stage_files,
            commands::unstage_files,
            commands::stage_all,
            commands::unstage_all,
            commands::discard_changes,
            commands::cherry_pick,
            commands::revert_commit,
            commands::reset_to_commit,
            // Diff
            commands::get_working_diff,
            commands::get_staged_diff,
            commands::get_commit_diff,
            commands::get_file_diff,
            commands::get_file_blame,
            // Conflict
            commands::get_conflict_info,
            commands::get_conflicted_file,
            commands::resolve_conflict,
            commands::abort_merge,
            // Remote
            commands::get_remotes,
            commands::add_remote,
            commands::remove_remote,
            commands::rename_remote,
            commands::fetch_remote,
            commands::pull_remote,
            commands::push_remote,
            commands::set_upstream,
            // Stash
            commands::get_stash_list,
            commands::create_stash,
            commands::apply_stash,
            commands::pop_stash,
            commands::drop_stash,
            commands::clear_stashes,
            // GitHub / Pull Requests
            commands::check_github_cli,
            commands::list_pull_requests,
            commands::get_pull_request,
            commands::create_pull_request,
            commands::get_pull_request_reviews,
            commands::get_pull_request_comments,
            commands::get_pull_request_files,
            commands::review_pull_request,
            commands::comment_pull_request,
            commands::merge_pull_request,
            commands::close_pull_request,
            commands::reopen_pull_request,
            commands::ready_pull_request,
            commands::get_pull_request_diff,
            commands::checkout_pull_request,
            // Terminal
            commands::terminal_init,
            commands::terminal_execute,
            commands::terminal_set_dir,
            commands::terminal_get_dir,
            commands::terminal_set_shell,
            commands::terminal_get_shell,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
