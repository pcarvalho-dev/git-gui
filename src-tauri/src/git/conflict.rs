use crate::error::{AppError, AppResult};
use git2::Repository;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictInfo {
    pub path: String,
    pub ours_content: String,
    pub theirs_content: String,
    pub base_content: Option<String>,
    pub conflicts: Vec<ConflictSection>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictSection {
    pub id: usize,
    pub ours: String,
    pub theirs: String,
    pub base: Option<String>,
    pub start_line: usize,
    pub end_line: usize,
}

/// Get conflict information for a file
pub fn get_conflict_info(repo: &Repository, file_path: &str) -> AppResult<ConflictInfo> {
    let repo_path = repo.workdir().ok_or_else(|| AppError::internal("Bare repository"))?;
    let full_path = repo_path.join(file_path);

    if !full_path.exists() {
        return Err(AppError::with_details(
            "FILE_NOT_FOUND",
            "Arquivo não encontrado",
            file_path,
        ));
    }

    let content = fs::read_to_string(&full_path).map_err(|e| {
        AppError::with_details("READ_ERROR", "Erro ao ler arquivo", &e.to_string())
    })?;

    // Parse conflict markers
    let (ours_content, theirs_content, base_content, conflicts) = parse_conflict_markers(&content)?;

    Ok(ConflictInfo {
        path: file_path.to_string(),
        ours_content,
        theirs_content,
        base_content,
        conflicts,
    })
}

/// Parse git conflict markers from file content
fn parse_conflict_markers(content: &str) -> AppResult<(String, String, Option<String>, Vec<ConflictSection>)> {
    let lines: Vec<&str> = content.lines().collect();
    let mut conflicts = Vec::new();
    let mut ours_lines = Vec::new();
    let mut theirs_lines = Vec::new();

    let mut in_conflict = false;
    let mut in_ours = false;
    let mut in_base = false;
    let mut in_theirs = false;

    let mut current_ours = Vec::new();
    let mut current_theirs = Vec::new();
    let mut current_base: Vec<String> = Vec::new();
    let mut conflict_start = 0;
    let mut conflict_id = 0;
    let mut has_base = false;

    for (i, line) in lines.iter().enumerate() {
        if line.starts_with("<<<<<<<") {
            in_conflict = true;
            in_ours = true;
            in_base = false;
            in_theirs = false;
            conflict_start = i;
            current_ours.clear();
            current_theirs.clear();
            current_base.clear();
            has_base = false;
        } else if line.starts_with("|||||||") && in_conflict {
            // Base marker (diff3 style)
            in_ours = false;
            in_base = true;
            in_theirs = false;
            has_base = true;
        } else if line.starts_with("=======") && in_conflict {
            in_ours = false;
            in_base = false;
            in_theirs = true;
        } else if line.starts_with(">>>>>>>") && in_conflict {
            // End of conflict
            conflicts.push(ConflictSection {
                id: conflict_id,
                ours: current_ours.join("\n"),
                theirs: current_theirs.join("\n"),
                base: if has_base { Some(current_base.join("\n")) } else { None },
                start_line: conflict_start,
                end_line: i,
            });
            conflict_id += 1;

            // For ours/theirs content, use ours as default
            ours_lines.extend(current_ours.iter().cloned());
            theirs_lines.extend(current_theirs.iter().cloned());

            in_conflict = false;
            in_ours = false;
            in_base = false;
            in_theirs = false;
        } else if in_conflict {
            if in_ours {
                current_ours.push(line.to_string());
            } else if in_base {
                current_base.push(line.to_string());
            } else if in_theirs {
                current_theirs.push(line.to_string());
            }
        } else {
            // Normal line (outside conflict)
            ours_lines.push(line.to_string());
            theirs_lines.push(line.to_string());
        }
    }

    if conflicts.is_empty() {
        return Err(AppError::new(
            "NO_CONFLICTS",
            "Arquivo não possui marcadores de conflito",
        ));
    }

    Ok((
        ours_lines.join("\n"),
        theirs_lines.join("\n"),
        None, // Full base content not available in simple marker parsing
        conflicts,
    ))
}

/// Save resolved file content
pub fn save_resolved_file(repo: &Repository, file_path: &str, content: &str) -> AppResult<()> {
    let repo_path = repo.workdir().ok_or_else(|| AppError::internal("Bare repository"))?;
    let full_path = repo_path.join(file_path);

    fs::write(&full_path, content).map_err(|e| {
        AppError::with_details("WRITE_ERROR", "Erro ao salvar arquivo", &e.to_string())
    })?;

    Ok(())
}

/// Mark file as resolved (stage it)
pub fn mark_resolved(repo: &Repository, file_path: &str) -> AppResult<()> {
    let mut index = repo.index()?;
    index.add_path(Path::new(file_path))?;
    index.write()?;
    Ok(())
}

/// Abort the current merge
pub fn abort_merge(repo: &Repository) -> AppResult<()> {
    // Check if we're in a merge state
    if repo.state() != git2::RepositoryState::Merge {
        return Err(AppError::new("NOT_MERGING", "Não há merge em andamento"));
    }

    // Reset to HEAD
    let head = repo.head()?.peel_to_commit()?;
    repo.reset(head.as_object(), git2::ResetType::Hard, None)?;

    // Clean up merge state
    repo.cleanup_state()?;

    Ok(())
}

/// Get the raw content with conflict markers
pub fn get_conflicted_file_content(repo: &Repository, file_path: &str) -> AppResult<String> {
    let repo_path = repo.workdir().ok_or_else(|| AppError::internal("Bare repository"))?;
    let full_path = repo_path.join(file_path);

    fs::read_to_string(&full_path).map_err(|e| {
        AppError::with_details("READ_ERROR", "Erro ao ler arquivo", &e.to_string())
    })
}
