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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AppState::new())
        .manage(create_terminal_state())
        .invoke_handler(tauri::generate_handler![
            // Repository
            commands::open_repo,
            commands::close_repo,
            commands::close_repo_by_id,
            commands::get_open_repos,
            commands::set_active_repo,
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
            commands::open_in_explorer,
            commands::open_in_terminal,
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
            commands::stage_partial_changes,
            commands::unstage_files,
            commands::unstage_partial_changes,
            commands::stage_all,
            commands::unstage_all,
            commands::discard_changes,
            commands::cherry_pick,
            commands::revert_commit,
            commands::reset_to_commit,
            commands::compare_refs,
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
            // Issues
            commands::list_issues,
            commands::get_issue,
            commands::create_issue,
            commands::edit_issue,
            commands::close_issue,
            commands::reopen_issue,
            commands::list_issue_comments,
            commands::add_issue_comment,
            commands::list_github_projects,
            commands::list_labels,
            commands::create_label,
            commands::edit_label,
            commands::delete_label,
            commands::list_milestones,
            commands::create_milestone,
            commands::edit_milestone,
            commands::delete_milestone,
            commands::list_collaborators,
            commands::edit_issue_comment,
            commands::delete_issue_comment,
            commands::lock_issue,
            commands::unlock_issue,
            commands::get_issue_timeline,
            commands::list_issue_reactions,
            commands::add_issue_reaction,
            commands::list_comment_reactions,
            commands::add_comment_reaction,
            commands::list_issue_templates,
            // Terminal
            commands::terminal_init,
            commands::terminal_execute,
            commands::terminal_set_dir,
            commands::terminal_get_dir,
            commands::terminal_set_shell,
            commands::terminal_get_shell,
            commands::terminal_get_platform,
            commands::get_install_type,
            commands::install_deb_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
