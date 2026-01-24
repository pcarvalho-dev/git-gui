use crate::error::{AppError, AppResult};
use git2::{DiffOptions, Oid, Repository};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiffInfo {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
    pub additions: usize,
    pub deletions: usize,
    pub is_binary: bool,
    pub hunks: Vec<HunkInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HunkInfo {
    pub header: String,
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<LineInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LineInfo {
    pub old_line: Option<u32>,
    pub new_line: Option<u32>,
    pub content: String,
    pub origin: char,
    pub line_type: LineType,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LineType {
    Context,
    Addition,
    Deletion,
    Header,
    Binary,
}

pub fn get_working_diff(repo: &Repository) -> AppResult<Vec<DiffInfo>> {
    let mut diff_opts = DiffOptions::new();
    diff_opts.include_untracked(true);

    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());

    let diff = repo.diff_tree_to_workdir_with_index(head_tree.as_ref(), Some(&mut diff_opts))?;

    parse_diff(&diff, repo)
}

pub fn get_staged_diff(repo: &Repository) -> AppResult<Vec<DiffInfo>> {
    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());

    let diff = repo.diff_tree_to_index(head_tree.as_ref(), None, None)?;

    parse_diff(&diff, repo)
}

pub fn get_commit_diff(repo: &Repository, commit_hash: &str) -> AppResult<Vec<DiffInfo>> {
    let oid = Oid::from_str(commit_hash).map_err(|_| AppError::commit_not_found(commit_hash))?;
    let commit = repo.find_commit(oid)?;
    let tree = commit.tree()?;

    let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());

    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None)?;

    parse_diff(&diff, repo)
}

pub fn get_file_diff(
    repo: &Repository,
    file_path: &str,
    staged: bool,
    repo_path: &PathBuf,
) -> AppResult<DiffInfo> {
    // Check if untracked
    let mut status_opts = git2::StatusOptions::new();
    status_opts.include_untracked(true);
    let statuses = repo.statuses(Some(&mut status_opts))?;

    let is_untracked = statuses
        .iter()
        .any(|e| e.path() == Some(file_path) && e.status().is_wt_new());

    if is_untracked && !staged {
        return get_untracked_file_diff(file_path, repo_path);
    }

    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());

    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(file_path);

    let diff = if staged {
        repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut diff_opts))?
    } else {
        let mut index = repo.index()?;
        repo.diff_index_to_workdir(Some(&mut index), Some(&mut diff_opts))?
    };

    let diffs = parse_diff(&diff, repo)?;
    diffs
        .into_iter()
        .find(|d| d.path == file_path)
        .ok_or_else(|| AppError::with_details("FILE_NOT_IN_DIFF", "Arquivo não encontrado no diff", file_path))
}

fn get_untracked_file_diff(file_path: &str, repo_path: &PathBuf) -> AppResult<DiffInfo> {
    let full_path = repo_path.join(file_path);
    let content = std::fs::read_to_string(&full_path)?;

    let lines: Vec<LineInfo> = content
        .lines()
        .enumerate()
        .map(|(i, line)| LineInfo {
            old_line: None,
            new_line: Some((i + 1) as u32),
            content: line.to_string(),
            origin: '+',
            line_type: LineType::Addition,
        })
        .collect();

    let additions = lines.len();

    Ok(DiffInfo {
        path: file_path.to_string(),
        old_path: None,
        status: "added".to_string(),
        additions,
        deletions: 0,
        is_binary: false,
        hunks: vec![HunkInfo {
            header: format!("@@ -0,0 +1,{} @@", additions),
            old_start: 0,
            old_lines: 0,
            new_start: 1,
            new_lines: additions as u32,
            lines,
        }],
    })
}

fn parse_diff(diff: &git2::Diff, _repo: &Repository) -> AppResult<Vec<DiffInfo>> {
    let mut diffs = Vec::new();

    for delta_idx in 0..diff.deltas().len() {
        let delta = diff.get_delta(delta_idx).unwrap();

        let old_path = delta.old_file().path().map(|p| p.to_string_lossy().to_string());
        let new_path = delta.new_file().path().map(|p| p.to_string_lossy().to_string());
        let path = new_path.clone().unwrap_or_else(|| old_path.clone().unwrap_or_default());

        let status = match delta.status() {
            git2::Delta::Added => "added",
            git2::Delta::Deleted => "deleted",
            git2::Delta::Modified => "modified",
            git2::Delta::Renamed => "renamed",
            git2::Delta::Copied => "copied",
            git2::Delta::Untracked => "untracked",
            _ => "unknown",
        };

        let is_binary = delta.flags().is_binary();

        if is_binary {
            diffs.push(DiffInfo {
                path,
                old_path,
                status: status.to_string(),
                additions: 0,
                deletions: 0,
                is_binary: true,
                hunks: vec![],
            });
            continue;
        }

        // Get patch for this delta
        let patch = match git2::Patch::from_diff(diff, delta_idx)? {
            Some(p) => p,
            None => continue,
        };

        let mut hunks = Vec::new();
        let mut total_additions = 0;
        let mut total_deletions = 0;

        for hunk_idx in 0..patch.num_hunks() {
            let (hunk, _) = patch.hunk(hunk_idx)?;

            let header = format!(
                "@@ -{},{} +{},{} @@",
                hunk.old_start(),
                hunk.old_lines(),
                hunk.new_start(),
                hunk.new_lines()
            );

            let mut lines = Vec::new();

            for line_idx in 0..patch.num_lines_in_hunk(hunk_idx).unwrap_or(0) {
                let line = patch.line_in_hunk(hunk_idx, line_idx)?;

                let origin = line.origin();
                let line_type = match origin {
                    '+' | '>' => {
                        total_additions += 1;
                        LineType::Addition
                    }
                    '-' | '<' => {
                        total_deletions += 1;
                        LineType::Deletion
                    }
                    '@' => LineType::Header,
                    _ => LineType::Context,
                };

                let content = String::from_utf8_lossy(line.content()).to_string();
                // Remove trailing newline for cleaner display
                let content = content.trim_end_matches('\n').to_string();

                lines.push(LineInfo {
                    old_line: line.old_lineno(),
                    new_line: line.new_lineno(),
                    content,
                    origin,
                    line_type,
                });
            }

            hunks.push(HunkInfo {
                header,
                old_start: hunk.old_start(),
                old_lines: hunk.old_lines(),
                new_start: hunk.new_start(),
                new_lines: hunk.new_lines(),
                lines,
            });
        }

        diffs.push(DiffInfo {
            path,
            old_path,
            status: status.to_string(),
            additions: total_additions,
            deletions: total_deletions,
            is_binary: false,
            hunks,
        });
    }

    Ok(diffs)
}

pub fn get_file_blame(repo: &Repository, file_path: &str) -> AppResult<Vec<BlameInfo>> {
    let blame = repo.blame_file(std::path::Path::new(file_path), None)?;

    let mut result = Vec::new();
    let mut current_line = 1u32;

    for hunk in blame.iter() {
        let sig = hunk.final_signature();
        let commit_id = hunk.final_commit_id();

        for _ in 0..hunk.lines_in_hunk() {
            result.push(BlameInfo {
                line: current_line,
                commit_hash: commit_id.to_string()[..7].to_string(),
                author: sig.name().unwrap_or("").to_string(),
                date: sig.when().seconds(),
            });
            current_line += 1;
        }
    }

    Ok(result)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BlameInfo {
    pub line: u32,
    pub commit_hash: String,
    pub author: String,
    pub date: i64,
}
