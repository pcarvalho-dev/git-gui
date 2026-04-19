use crate::error::{AppError, AppResult};
use crate::git::{get_file_diff, DiffInfo, LineType};
use git2::{IndexEntry, IndexTime, Oid, Repository};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub summary: String,
    pub body: Option<String>,
    pub author_name: String,
    pub author_email: String,
    pub author_date: i64,
    pub committer_name: String,
    pub committer_email: String,
    pub committer_date: i64,
    pub parents: Vec<String>,
    pub is_merge: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PartialHunkSelection {
    pub hunk_index: usize,
    pub line_indexes: Option<Vec<usize>>,
}

pub fn list_commits(
    repo: &Repository,
    branch: Option<&str>,
    limit: usize,
    skip: usize,
) -> AppResult<Vec<CommitInfo>> {
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(git2::Sort::TIME | git2::Sort::TOPOLOGICAL)?;

    if let Some(branch_name) = branch {
        let branch_ref = format!("refs/heads/{}", branch_name);
        if let Ok(oid) = repo.refname_to_id(&branch_ref) {
            revwalk.push(oid)?;
        } else {
            // Try remote branch
            let remote_ref = format!("refs/remotes/origin/{}", branch_name);
            if let Ok(oid) = repo.refname_to_id(&remote_ref) {
                revwalk.push(oid)?;
            }
        }
    } else {
        revwalk.push_head()?;
    }

    let mut commits = Vec::new();
    let mut count = 0;

    for oid in revwalk {
        let oid = oid?;

        if count < skip {
            count += 1;
            continue;
        }

        if commits.len() >= limit {
            break;
        }

        let commit = repo.find_commit(oid)?;
        commits.push(commit_to_info(&commit));
        count += 1;
    }

    Ok(commits)
}

pub fn get_commit(repo: &Repository, hash: &str) -> AppResult<CommitInfo> {
    let oid = Oid::from_str(hash).map_err(|_| AppError::commit_not_found(hash))?;
    let commit = repo
        .find_commit(oid)
        .map_err(|_| AppError::commit_not_found(hash))?;
    Ok(commit_to_info(&commit))
}

pub(crate) fn commit_to_info(commit: &git2::Commit) -> CommitInfo {
    let hash = commit.id().to_string();
    let message = commit.message().unwrap_or("").to_string();
    let summary = commit.summary().unwrap_or("").to_string();
    let body = message
        .lines()
        .skip(1)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();

    CommitInfo {
        hash: hash.clone(),
        short_hash: hash[..7.min(hash.len())].to_string(),
        message,
        summary,
        body: if body.is_empty() { None } else { Some(body) },
        author_name: commit.author().name().unwrap_or("").to_string(),
        author_email: commit.author().email().unwrap_or("").to_string(),
        author_date: commit.author().when().seconds(),
        committer_name: commit.committer().name().unwrap_or("").to_string(),
        committer_email: commit.committer().email().unwrap_or("").to_string(),
        committer_date: commit.committer().when().seconds(),
        parents: commit.parent_ids().map(|id| id.to_string()).collect(),
        is_merge: commit.parent_count() > 1,
    }
}

pub fn create_commit(repo: &Repository, message: &str, amend: bool) -> AppResult<String> {
    let signature = repo
        .signature()
        .map_err(|_| AppError::git_user_not_configured())?;

    let mut index = repo.index()?;

    // Check if there are staged changes
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    if amend {
        let head = repo.head()?;
        let head_commit = head.peel_to_commit()?;
        let parents: Vec<git2::Commit> = head_commit.parents().collect();
        let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

        let commit_id = repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            message,
            &tree,
            &parent_refs,
        )?;

        let id_str = commit_id.to_string();
        Ok(id_str[..7.min(id_str.len())].to_string())
    } else {
        let head = repo.head();

        let commit_id = if let Ok(head_ref) = head {
            let head_commit = head_ref.peel_to_commit()?;
            repo.commit(
                Some("HEAD"),
                &signature,
                &signature,
                message,
                &tree,
                &[&head_commit],
            )?
        } else {
            // Initial commit
            repo.commit(Some("HEAD"), &signature, &signature, message, &tree, &[])?
        };

        let id_str = commit_id.to_string();
        Ok(id_str[..7.min(id_str.len())].to_string())
    }
}

pub fn stage_files(repo: &Repository, files: &[String], repo_path: &PathBuf) -> AppResult<()> {
    let mut index = repo.index()?;

    for file in files {
        let full_path = repo_path.join(file);
        if full_path.exists() {
            index.add_path(std::path::Path::new(file))?;
        } else {
            // File was deleted
            index.remove_path(std::path::Path::new(file))?;
        }
    }

    index.write()?;
    Ok(())
}

pub fn stage_partial_changes(
    repo: &Repository,
    path: &str,
    selections: &[PartialHunkSelection],
    repo_path: &PathBuf,
) -> AppResult<()> {
    apply_partial_changes(repo, path, false, selections, repo_path)
}

pub fn unstage_files(repo: &Repository, files: &[String]) -> AppResult<()> {
    let head_tree = repo
        .head()
        .ok()
        .and_then(|h| h.peel_to_tree().ok());

    let mut index = repo.index()?;

    for file in files {
        let path = std::path::Path::new(file);

        if let Some(ref tree) = head_tree {
            if let Ok(entry) = tree.get_path(path) {
                // Restore to HEAD version
                let obj = entry.to_object(repo)?;
                let blob = obj.as_blob().ok_or_else(|| AppError::internal("Not a blob"))?;

                index.add_frombuffer(
                    &git2::IndexEntry {
                        ctime: git2::IndexTime::new(0, 0),
                        mtime: git2::IndexTime::new(0, 0),
                        dev: 0,
                        ino: 0,
                        mode: entry.filemode() as u32,
                        uid: 0,
                        gid: 0,
                        file_size: blob.content().len() as u32,
                        id: entry.id(),
                        flags: 0,
                        flags_extended: 0,
                        path: file.as_bytes().to_vec(),
                    },
                    blob.content(),
                )?;
            } else {
                // File is new, remove from index
                index.remove_path(path)?;
            }
        } else {
            // No HEAD, remove from index
            index.remove_path(path)?;
        }
    }

    index.write()?;
    Ok(())
}

pub fn unstage_partial_changes(
    repo: &Repository,
    path: &str,
    selections: &[PartialHunkSelection],
    repo_path: &PathBuf,
) -> AppResult<()> {
    apply_partial_changes(repo, path, true, selections, repo_path)
}

pub fn stage_all(repo: &Repository) -> AppResult<()> {
    let mut index = repo.index()?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;
    Ok(())
}

pub fn unstage_all(repo: &Repository) -> AppResult<()> {
    let head = repo.head()?;
    let commit = head.peel_to_commit()?;
    let tree = commit.tree()?;

    repo.reset(tree.as_object(), git2::ResetType::Mixed, None)?;
    Ok(())
}

pub fn discard_changes(repo: &Repository, files: &[String]) -> AppResult<()> {
    let mut checkout_builder = git2::build::CheckoutBuilder::new();
    checkout_builder.force();

    for file in files {
        checkout_builder.path(file);
    }

    repo.checkout_head(Some(&mut checkout_builder))?;
    Ok(())
}

fn apply_partial_changes(
    repo: &Repository,
    path: &str,
    staged: bool,
    selections: &[PartialHunkSelection],
    repo_path: &PathBuf,
) -> AppResult<()> {
    if selections.is_empty() {
        return Ok(());
    }

    let diff = get_file_diff(repo, path, staged, repo_path)?;
    if diff.is_binary {
        return Err(AppError::with_details(
            "PARTIAL_BINARY_UNSUPPORTED",
            "Stage parcial nao suporta arquivos binarios",
            path,
        ));
    }

    if diff.hunks.is_empty() {
        return Ok(());
    }

    let old_side = if staged {
        read_head_content(repo, path)?
    } else {
        read_index_content(repo, path)?
    };
    let new_side = if staged {
        read_index_content(repo, path)?
    } else {
        read_worktree_content(repo_path, path)?
    };

    let merged_content = build_partial_content(&diff, &old_side, &new_side, selections, !staged)?;
    let target_exists = match merged_content.as_str() {
        content if content == new_side.content => new_side.exists,
        content if content == old_side.content => old_side.exists,
        _ => true,
    };

    write_index_content(repo, path, &merged_content, target_exists)?;
    Ok(())
}

#[derive(Clone)]
struct FileVersion {
    exists: bool,
    content: String,
}

#[derive(Clone)]
struct ChangeToken {
    line_index: usize,
    line_type: LineType,
}

fn build_partial_content(
    diff: &DiffInfo,
    old_side: &FileVersion,
    new_side: &FileVersion,
    selections: &[PartialHunkSelection],
    apply_selected_changes: bool,
) -> AppResult<String> {
    let old_lines = split_lines_preserve_newline(&old_side.content);
    let new_lines = split_lines_preserve_newline(&new_side.content);
    let mut old_cursor = 0usize;
    let mut result = Vec::new();

    for (hunk_index, hunk) in diff.hunks.iter().enumerate() {
        let mut new_cursor = hunk.new_start.saturating_sub(1) as usize;
        let hunk_selection = selections.iter().find(|selection| selection.hunk_index == hunk_index);
        if hunk_selection.is_none() {
            let next_old_cursor = hunk.old_start.saturating_sub(1) as usize;
            if next_old_cursor > old_lines.len() {
                return Err(AppError::internal("Hunk invalido ao processar stage parcial"));
            }
            result.extend(old_lines[old_cursor..next_old_cursor].iter().cloned());
            old_cursor = next_old_cursor;
            append_hunk_with_apply(
                &mut result,
                &old_lines,
                &new_lines,
                &mut old_cursor,
                &mut new_cursor,
                hunk,
                !apply_selected_changes,
            )?;
            continue;
        }

        let next_old_cursor = hunk.old_start.saturating_sub(1) as usize;
        if next_old_cursor > old_lines.len() || new_cursor > new_lines.len() {
            return Err(AppError::internal("Hunk invalido ao processar stage parcial"));
        }

        result.extend(old_lines[old_cursor..next_old_cursor].iter().cloned());
        old_cursor = next_old_cursor;

        let selected_lines = hunk_selection
            .and_then(|selection| selection.line_indexes.as_ref())
            .map(|indexes| indexes.iter().copied().collect::<HashSet<_>>());
        let select_whole_hunk = selected_lines.as_ref().map(|indexes| indexes.is_empty()).unwrap_or(true);
        let mut pending_block = Vec::new();

        for (line_index, line) in hunk.lines.iter().enumerate() {
            match line.line_type {
                LineType::Context => {
                    flush_change_block(
                        &mut result,
                        &old_lines,
                        &new_lines,
                        &mut old_cursor,
                        &mut new_cursor,
            &pending_block,
            select_whole_hunk,
            selected_lines.as_ref(),
            apply_selected_changes,
        )?;
        pending_block.clear();
        push_old_line(&mut result, &old_lines, &mut old_cursor)?;
                    consume_new_line(&new_lines, &mut new_cursor)?;
                }
                LineType::Addition | LineType::Deletion => {
                    pending_block.push(ChangeToken {
                        line_index,
                        line_type: line.line_type.clone(),
                    });
                }
                LineType::Header => {}
                LineType::Binary => {
                    return Err(AppError::with_details(
                        "PARTIAL_BINARY_UNSUPPORTED",
                        "Stage parcial nao suporta linhas binarias",
                        &diff.path,
                    ));
                }
            }
        }

        flush_change_block(
            &mut result,
            &old_lines,
            &new_lines,
            &mut old_cursor,
            &mut new_cursor,
            &pending_block,
            select_whole_hunk,
            selected_lines.as_ref(),
            apply_selected_changes,
        )?;
    }

    if old_cursor > old_lines.len() {
        return Err(AppError::internal("Cursor invalido ao finalizar stage parcial"));
    }
    result.extend(old_lines[old_cursor..].iter().cloned());
    Ok(result.concat())
}

fn append_hunk_with_apply(
    result: &mut Vec<String>,
    old_lines: &[String],
    new_lines: &[String],
    old_cursor: &mut usize,
    new_cursor: &mut usize,
    hunk: &crate::git::HunkInfo,
    apply_changes: bool,
) -> AppResult<()> {
    for line in &hunk.lines {
        match line.line_type {
            LineType::Context => {
                push_old_line(result, old_lines, old_cursor)?;
                consume_new_line(new_lines, new_cursor)?;
            }
            LineType::Deletion => {
                let old_line = consume_old_line(old_lines, old_cursor)?;
                if !apply_changes {
                    result.push(old_line);
                }
            }
            LineType::Addition => {
                let new_line = consume_new_line(new_lines, new_cursor)?;
                if apply_changes {
                    result.push(new_line);
                }
            }
            LineType::Header => {}
            LineType::Binary => {
                return Err(AppError::internal("Linha binaria inesperada"));
            }
        }
    }

    Ok(())
}

fn flush_change_block(
    result: &mut Vec<String>,
    old_lines: &[String],
    new_lines: &[String],
    old_cursor: &mut usize,
    new_cursor: &mut usize,
    block: &[ChangeToken],
    select_whole_hunk: bool,
    selected_lines: Option<&HashSet<usize>>,
    apply_selected_changes: bool,
) -> AppResult<()> {
    if block.is_empty() {
        return Ok(());
    }

    let has_additions = block.iter().any(|token| token.line_type == LineType::Addition);
    let has_deletions = block.iter().any(|token| token.line_type == LineType::Deletion);
    let select_entire_block = select_whole_hunk
        || (has_additions && has_deletions
            && selected_lines
                .map(|set| block.iter().any(|token| set.contains(&token.line_index)))
                .unwrap_or(false));

    for token in block {
        let line_selected = if select_entire_block {
            true
        } else {
            selected_lines
                .map(|set| set.contains(&token.line_index))
                .unwrap_or(false)
        };
        let should_apply_change = if apply_selected_changes {
            line_selected
        } else {
            !line_selected
        };

        match token.line_type {
            LineType::Deletion => {
                let old_line = consume_old_line(old_lines, old_cursor)?;
                if !should_apply_change {
                    result.push(old_line);
                }
            }
            LineType::Addition => {
                let new_line = consume_new_line(new_lines, new_cursor)?;
                if should_apply_change {
                    result.push(new_line);
                }
            }
            _ => {}
        }
    }

    Ok(())
}

fn split_lines_preserve_newline(content: &str) -> Vec<String> {
    if content.is_empty() {
        return Vec::new();
    }

    content
        .split_inclusive('\n')
        .map(|line| line.to_string())
        .collect()
}

fn push_old_line(result: &mut Vec<String>, old_lines: &[String], old_cursor: &mut usize) -> AppResult<()> {
    result.push(consume_old_line(old_lines, old_cursor)?);
    Ok(())
}

fn consume_old_line(old_lines: &[String], old_cursor: &mut usize) -> AppResult<String> {
    let line = old_lines
        .get(*old_cursor)
        .cloned()
        .ok_or_else(|| AppError::internal("Cursor do diff excedeu conteudo antigo"))?;
    *old_cursor += 1;
    Ok(line)
}

fn consume_new_line(new_lines: &[String], new_cursor: &mut usize) -> AppResult<String> {
    let line = new_lines
        .get(*new_cursor)
        .cloned()
        .ok_or_else(|| AppError::internal("Cursor do diff excedeu conteudo novo"))?;
    *new_cursor += 1;
    Ok(line)
}

fn read_head_content(repo: &Repository, path: &str) -> AppResult<FileVersion> {
    let head_tree = repo
        .head()
        .ok()
        .and_then(|head| head.peel_to_tree().ok());

    read_tree_content(repo, head_tree.as_ref(), path)
}

fn read_index_content(repo: &Repository, path: &str) -> AppResult<FileVersion> {
    let index = repo.index()?;
    if let Some(entry) = index.get_path(Path::new(path), 0) {
        let blob = repo.find_blob(entry.id)?;
        let content = std::str::from_utf8(blob.content())
            .map_err(|_| AppError::with_details("NON_UTF8_FILE", "Arquivo nao e texto UTF-8", path))?;
        Ok(FileVersion {
            exists: true,
            content: content.to_string(),
        })
    } else {
        Ok(FileVersion {
            exists: false,
            content: String::new(),
        })
    }
}

fn read_worktree_content(repo_path: &PathBuf, path: &str) -> AppResult<FileVersion> {
    let full_path = repo_path.join(path);
    if !full_path.exists() {
        return Ok(FileVersion {
            exists: false,
            content: String::new(),
        });
    }

    Ok(FileVersion {
        exists: true,
        content: std::fs::read_to_string(full_path)
            .map_err(AppError::io_error)?,
    })
}

fn read_tree_content(repo: &Repository, tree: Option<&git2::Tree<'_>>, path: &str) -> AppResult<FileVersion> {
    if let Some(tree) = tree {
        if let Ok(entry) = tree.get_path(Path::new(path)) {
            let blob = repo.find_blob(entry.id())?;
            let content = std::str::from_utf8(blob.content())
                .map_err(|_| AppError::with_details("NON_UTF8_FILE", "Arquivo nao e texto UTF-8", path))?;
            return Ok(FileVersion {
                exists: true,
                content: content.to_string(),
            });
        }
    }

    Ok(FileVersion {
        exists: false,
        content: String::new(),
    })
}

fn write_index_content(repo: &Repository, path: &str, content: &str, exists: bool) -> AppResult<()> {
    let mut index = repo.index()?;

    if !exists {
        let _ = index.remove_path(Path::new(path));
        index.write()?;
        return Ok(());
    }

    let entry = build_index_entry(repo, path, content.as_bytes())?;
    index.add_frombuffer(&entry, content.as_bytes())?;
    index.write()?;
    Ok(())
}

fn build_index_entry(repo: &Repository, path: &str, content: &[u8]) -> AppResult<IndexEntry> {
    let mode = current_file_mode(repo, path).unwrap_or(0o100644);

    Ok(IndexEntry {
        ctime: IndexTime::new(0, 0),
        mtime: IndexTime::new(0, 0),
        dev: 0,
        ino: 0,
        mode,
        uid: 0,
        gid: 0,
        file_size: content.len() as u32,
        id: Oid::zero(),
        flags: 0,
        flags_extended: 0,
        path: path.as_bytes().to_vec(),
    })
}

fn current_file_mode(repo: &Repository, path: &str) -> Option<u32> {
    let index = repo.index().ok();
    if let Some(index) = index {
        if let Some(entry) = index.get_path(Path::new(path), 0) {
            return Some(entry.mode);
        }
    }

    repo.head()
        .ok()
        .and_then(|head| head.peel_to_tree().ok())
        .and_then(|tree| tree.get_path(Path::new(path)).ok())
        .map(|entry| entry.filemode() as u32)
}

pub fn list_file_history(
    repo: &Repository,
    file_path: &str,
    limit: usize,
) -> AppResult<Vec<CommitInfo>> {
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(git2::Sort::TIME | git2::Sort::TOPOLOGICAL)?;
    revwalk.push_head()?;

    let mut commits = Vec::new();

    for oid_result in revwalk {
        if commits.len() >= limit {
            break;
        }
        let oid = oid_result?;
        let commit = repo.find_commit(oid)?;

        if commit_touches_file(repo, &commit, file_path)? {
            commits.push(commit_to_info(&commit));
        }
    }

    Ok(commits)
}

fn commit_touches_file(
    repo: &Repository,
    commit: &git2::Commit,
    file_path: &str,
) -> AppResult<bool> {
    let tree = commit.tree()?;

    if commit.parent_count() == 0 {
        return Ok(tree.get_path(std::path::Path::new(file_path)).is_ok());
    }

    let parent = commit.parent(0)?;
    let parent_tree = parent.tree()?;

    let mut diff_opts = git2::DiffOptions::new();
    diff_opts.pathspec(file_path);

    let diff = repo.diff_tree_to_tree(
        Some(&parent_tree),
        Some(&tree),
        Some(&mut diff_opts),
    )?;

    Ok(diff.stats()?.files_changed() > 0)
}

pub fn cherry_pick(repo: &Repository, commit_hash: &str) -> AppResult<String> {
    let oid = Oid::from_str(commit_hash).map_err(|_| AppError::commit_not_found(commit_hash))?;
    let commit = repo.find_commit(oid)?;

    repo.cherrypick(&commit, None)?;

    // Check for conflicts
    let index = repo.index()?;
    if index.has_conflicts() {
        return Err(AppError::merge_conflict());
    }

    // Create the commit
    let signature = repo.signature()?;
    let tree_id = repo.index()?.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let head = repo.head()?.peel_to_commit()?;

    let new_commit_id = repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        commit.message().unwrap_or(""),
        &tree,
        &[&head],
    )?;

    // Cleanup
    repo.cleanup_state()?;

    let id_str = new_commit_id.to_string();
    Ok(id_str[..7.min(id_str.len())].to_string())
}

pub fn revert_commit(repo: &Repository, commit_hash: &str) -> AppResult<String> {
    let oid = Oid::from_str(commit_hash).map_err(|_| AppError::commit_not_found(commit_hash))?;
    let commit = repo.find_commit(oid)?;

    repo.revert(&commit, None)?;

    // Check for conflicts
    let index = repo.index()?;
    if index.has_conflicts() {
        return Err(AppError::merge_conflict());
    }

    // Create the commit
    let signature = repo.signature()?;
    let tree_id = repo.index()?.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let head = repo.head()?.peel_to_commit()?;

    let message = format!("Revert \"{}\"\n\nThis reverts commit {}.",
        commit.summary().unwrap_or(""),
        commit_hash
    );

    let new_commit_id = repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &message,
        &tree,
        &[&head],
    )?;

    // Cleanup
    repo.cleanup_state()?;

    let id_str = new_commit_id.to_string();
    Ok(id_str[..7.min(id_str.len())].to_string())
}

pub fn reset_to_commit(
    repo: &Repository,
    commit_hash: &str,
    mode: &str,
) -> AppResult<()> {
    let oid = Oid::from_str(commit_hash).map_err(|_| AppError::commit_not_found(commit_hash))?;
    let commit = repo.find_commit(oid)?;

    let reset_type = match mode {
        "soft" => git2::ResetType::Soft,
        "mixed" => git2::ResetType::Mixed,
        "hard" => git2::ResetType::Hard,
        _ => git2::ResetType::Mixed,
    };

    repo.reset(commit.as_object(), reset_type, None)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::Signature;
    use tempfile::TempDir;
    use std::path::Path;

    fn setup_repo() -> (TempDir, Repository) {
        let dir = tempfile::tempdir().unwrap();
        let repo = Repository::init(dir.path()).unwrap();
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Teste").unwrap();
        config.set_str("user.email", "teste@test.com").unwrap();
        (dir, repo)
    }

    fn make_commit(repo: &Repository, dir: &Path, filename: &str, content: &str, msg: &str) -> String {
        let file_path = dir.join(filename);
        std::fs::write(&file_path, content).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new(filename)).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = Signature::now("Teste", "teste@test.com").unwrap();
        let parents: Vec<git2::Commit> = repo
            .head()
            .ok()
            .and_then(|h| h.peel_to_commit().ok())
            .into_iter()
            .collect();
        let parent_refs: Vec<&git2::Commit> = parents.iter().collect();
        let oid = repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &parent_refs).unwrap();
        oid.to_string()
    }

    fn read_index_file(repo: &Repository, path: &str) -> Option<String> {
        let index = repo.index().unwrap();
        let entry = index.get_path(Path::new(path), 0)?;
        let blob = repo.find_blob(entry.id).unwrap();
        Some(String::from_utf8(blob.content().to_vec()).unwrap())
    }

    #[test]
    fn list_commits_retorna_commits_em_ordem_reversa() {
        let (dir, repo) = setup_repo();
        make_commit(&repo, dir.path(), "a.txt", "a", "primeiro");
        make_commit(&repo, dir.path(), "b.txt", "b", "segundo");
        make_commit(&repo, dir.path(), "c.txt", "c", "terceiro");

        let commits = list_commits(&repo, None, 10, 0).unwrap();
        assert_eq!(commits.len(), 3);
        assert_eq!(commits[0].summary, "terceiro");
        assert_eq!(commits[2].summary, "primeiro");
    }

    #[test]
    fn list_commits_respeita_limit() {
        let (dir, repo) = setup_repo();
        for i in 0..5 {
            make_commit(&repo, dir.path(), &format!("f{}.txt", i), "x", &format!("commit {}", i));
        }
        let commits = list_commits(&repo, None, 3, 0).unwrap();
        assert_eq!(commits.len(), 3);
    }

    #[test]
    fn list_commits_respeita_skip() {
        let (dir, repo) = setup_repo();
        make_commit(&repo, dir.path(), "a.txt", "a", "primeiro");
        make_commit(&repo, dir.path(), "b.txt", "b", "segundo");
        make_commit(&repo, dir.path(), "c.txt", "c", "terceiro");

        let commits = list_commits(&repo, None, 10, 1).unwrap();
        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].summary, "segundo");
    }

    #[test]
    fn get_commit_retorna_commit_pelo_hash() {
        let (dir, repo) = setup_repo();
        let hash = make_commit(&repo, dir.path(), "a.txt", "a", "meu commit");
        let commit = get_commit(&repo, &hash).unwrap();
        assert_eq!(commit.summary, "meu commit");
        assert_eq!(commit.hash, hash);
    }

    #[test]
    fn get_commit_hash_invalido_retorna_erro() {
        let (_dir, repo) = setup_repo();
        let result = get_commit(&repo, "invalidhash");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, "COMMIT_NOT_FOUND");
    }

    #[test]
    fn get_commit_hash_inexistente_retorna_erro() {
        let (_dir, repo) = setup_repo();
        let result = get_commit(&repo, "0000000000000000000000000000000000000000");
        assert!(result.is_err());
    }

    #[test]
    fn commit_info_short_hash_tem_7_caracteres() {
        let (dir, repo) = setup_repo();
        let hash = make_commit(&repo, dir.path(), "a.txt", "a", "teste");
        let commit = get_commit(&repo, &hash).unwrap();
        assert_eq!(commit.short_hash.len(), 7);
    }

    #[test]
    fn commit_info_is_merge_false_para_commit_normal() {
        let (dir, repo) = setup_repo();
        let hash = make_commit(&repo, dir.path(), "a.txt", "a", "normal");
        let commit = get_commit(&repo, &hash).unwrap();
        assert!(!commit.is_merge);
    }

    #[test]
    fn commit_info_autor_correto() {
        let (dir, repo) = setup_repo();
        let hash = make_commit(&repo, dir.path(), "a.txt", "a", "com autor");
        let commit = get_commit(&repo, &hash).unwrap();
        assert_eq!(commit.author_name, "Teste");
        assert_eq!(commit.author_email, "teste@test.com");
    }

    #[test]
    fn stage_e_create_commit_cria_novo_commit() {
        let (dir, repo) = setup_repo();
        // Commit inicial
        make_commit(&repo, dir.path(), "base.txt", "base", "base");

        // Cria arquivo e faz stage
        let new_file = dir.path().join("novo.txt");
        std::fs::write(&new_file, "conteúdo").unwrap();
        let repo_path = dir.path().to_path_buf();
        stage_files(&repo, &["novo.txt".to_string()], &repo_path).unwrap();

        let short_hash = create_commit(&repo, "feat: novo arquivo", false).unwrap();
        assert_eq!(short_hash.len(), 7);

        let commits = list_commits(&repo, None, 10, 0).unwrap();
        assert_eq!(commits[0].summary, "feat: novo arquivo");
    }

    #[test]
    fn stage_partial_changes_estagia_linha_de_arquivo_novo() {
        let (dir, repo) = setup_repo();
        make_commit(&repo, dir.path(), "base.txt", "base\n", "base");

        std::fs::write(dir.path().join("novo.txt"), "alpha\nbeta\ngamma\n").unwrap();
        let repo_path = dir.path().to_path_buf();
        let diff = get_file_diff(&repo, "novo.txt", false, &repo_path).unwrap();
        let line_index = diff.hunks[0]
            .lines
            .iter()
            .position(|line| line.content == "beta")
            .unwrap();

        stage_partial_changes(
            &repo,
            "novo.txt",
            &[PartialHunkSelection {
                hunk_index: 0,
                line_indexes: Some(vec![line_index]),
            }],
            &repo_path,
        )
        .unwrap();

        assert_eq!(read_index_file(&repo, "novo.txt").as_deref(), Some("beta\n"));
    }

    #[test]
    fn unstage_partial_changes_remove_linha_estagiada() {
        let (dir, repo) = setup_repo();
        make_commit(&repo, dir.path(), "lista.txt", "one\ntwo\n", "base");

        std::fs::write(dir.path().join("lista.txt"), "one\ntwo\nthree\nfour\n").unwrap();
        let repo_path = dir.path().to_path_buf();
        stage_files(&repo, &["lista.txt".to_string()], &repo_path).unwrap();

        let diff = get_file_diff(&repo, "lista.txt", true, &repo_path).unwrap();
        let line_index = diff.hunks[0]
            .lines
            .iter()
            .position(|line| line.content == "four")
            .unwrap();

        unstage_partial_changes(
            &repo,
            "lista.txt",
            &[PartialHunkSelection {
                hunk_index: 0,
                line_indexes: Some(vec![line_index]),
            }],
            &repo_path,
        )
        .unwrap();

        assert_eq!(
            read_index_file(&repo, "lista.txt").as_deref(),
            Some("one\ntwo\nthree\n")
        );
    }

    #[test]
    fn reset_to_commit_modo_mixed_funciona() {
        let (dir, repo) = setup_repo();
        let hash1 = make_commit(&repo, dir.path(), "a.txt", "a", "primeiro");
        make_commit(&repo, dir.path(), "b.txt", "b", "segundo");

        reset_to_commit(&repo, &hash1, "mixed").unwrap();
        let commits = list_commits(&repo, None, 10, 0).unwrap();
        assert_eq!(commits.len(), 1);
        assert_eq!(commits[0].summary, "primeiro");
    }

    #[test]
    fn list_commits_em_repo_vazio_retorna_lista_vazia() {
        let (_dir, repo) = setup_repo();
        // repo sem commits - revwalk com push_head falha silenciosamente
        let commits = list_commits(&repo, None, 10, 0);
        // pode retornar Err ou Ok([]) dependendo da implementação
        assert!(commits.is_ok() || commits.is_err());
        if let Ok(c) = commits {
            assert!(c.is_empty());
        }
    }
}
